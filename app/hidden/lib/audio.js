/**
 * Web Audio playback. One shared AudioContext with a gain-controlled channel
 * for the hourly music and one for the rain ambience.
 */
const fs = require('fs')

const FADE_MS = 400
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

class Channel {
  constructor (context) {
    this.context = context
    this.gain = context.createGain()
    this.gain.gain.value = 0
    this.gain.connect(context.destination)
    this.volume = 0.5
    this.source = null
  }

  get playing () {
    return this.source !== null
  }

  setVolume (volume) {
    this.volume = volume
    if (this.source) this.ramp(volume, 50)
  }

  ramp (to, ms) {
    const now = this.context.currentTime
    const gain = this.gain.gain
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(gain.value, now)
    gain.linearRampToValueAtTime(to, now + ms / 1000)
    return sleep(ms)
  }

  /**
   * Starts a decoded buffer, fading the previous one out first.
   * `onEnded` only fires when the buffer plays to its end, not when stopped.
   */
  async play (buffer, { loop = false, onEnded = null } = {}) {
    await this.stop()
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.loop = loop
    source.connect(this.gain)
    source.onended = () => {
      if (this.source !== source) return
      this.source = null
      if (onEnded) onEnded()
    }
    this.source = source
    this.gain.gain.value = 0
    source.start()
    await this.ramp(this.volume, FADE_MS)
  }

  setLoop (loop) {
    if (this.source) this.source.loop = loop
  }

  async stop () {
    const source = this.source
    if (!source) return
    await this.ramp(0, FADE_MS)
    if (this.source !== source) return
    this.source = null
    try {
      source.stop()
      source.disconnect()
    } catch (err) {
      // already finished
    }
  }
}

class AudioEngine {
  constructor () {
    this.context = new window.AudioContext()
    this.music = new Channel(this.context)
    this.rain = new Channel(this.context)
  }

  /** Reads a local file or remote URL and decodes it. Throws on failure. */
  async decode (location) {
    let bytes
    if (/^https?:/.test(location)) {
      const response = await fetch(location)
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${location}`)
      bytes = await response.arrayBuffer()
    } else {
      const buffer = await fs.promises.readFile(location)
      bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    }
    return this.context.decodeAudioData(bytes)
  }
}

module.exports = { AudioEngine }
