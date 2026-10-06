/**
 * The town tune: the hourly chime built from sampled bells, and the little
 * synth beeps used while editing the tune.
 */
const Wad = window.Wad

const NOTES = ['G0', 'A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'A2', 'B2', 'C2', 'D2', 'E2']
const BEEP_PITCHES = ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6']
const REST = 'zZz'
const HOLD = '-'
const RANDOM = '?'
const CHIME_STEP_MS = 900
const BEEP_STEP_MS = 350

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const randomNote = () => NOTES[Math.floor(Math.random() * NOTES.length)]

class TownTune {
  constructor (volume) {
    this.volume = volume
    this.chime = new Wad({
      source: 'chime.ogg',
      sprite: Object.fromEntries(NOTES.map((note, i) => [note, [i * 4, i * 4 + 4]])),
      volume
    })
    this.beep = new Wad({
      source: 'triangle',
      env: { hold: -1, release: 0.2, sustain: 0.1 },
      pitch: 'G4',
      volume: 0.5
    })
    this.beepTimeout = null
  }

  setVolume (volume) {
    this.volume = volume
    this.chime.setVolume(volume)
  }

  /** Plays the 16-step tune on the bells, then fades the bells out. */
  async playChime (tune) {
    for (const step of tune) {
      this.chime.setVolume(this.volume)
      if (step === RANDOM) this.chime[randomNote()].play()
      else if (step !== REST && step !== HOLD && this.chime[step]) this.chime[step].play()
      await sleep(CHIME_STEP_MS)
    }
    for (let v = this.volume * 100; v >= 0; v--) {
      await sleep(5)
      this.chime.setVolume(v / 100)
    }
    this.chime.stop()
  }

  /**
   * Plays the editor's beeps. Each step is the 1-based slider value:
   * 1 = rest, 2 = hold the previous note, 3..15 = notes, 16 = random.
   */
  async playBeeps (steps) {
    for (const [index, value] of steps.entries()) {
      let holds = 0
      while (steps[index + 1 + holds] === '2') holds++
      await this.playBeep(value, BEEP_STEP_MS * (holds + 1))
    }
  }

  async playBeep (value, duration) {
    if (value === '2') return
    clearTimeout(this.beepTimeout)
    this.beep.stop()
    if (value !== '1') {
      const pitchIndex = value === '16' ? Math.floor(Math.random() * BEEP_PITCHES.length) : Number(value) - 3
      this.beep.play({ pitch: BEEP_PITCHES[pitchIndex] })
    }
    await new Promise(resolve => {
      this.beepTimeout = setTimeout(() => {
        this.beep.stop()
        resolve()
      }, duration)
    })
  }
}

module.exports = { TownTune, NOTES }
