/**
 * The hidden player window. It owns all audio and talks to the visible window
 * over IPC: it receives `toPlayer` commands and emits `toWindow` events.
 */
const ipc = require('electron').ipcRenderer
const superagent = require('superagent')
const logger = require('electron-log')
const games = require('../shared/games')
const { now } = require('../shared/clock')
const { Settings } = require('./lib/settings')
const { AudioEngine } = require('./lib/audio')
const { Library, LibraryError, RAIN_GAME } = require('./lib/library')
const { WeatherService } = require('./lib/weather')
const { TownTune } = require('./lib/tune')
const dev = require('./lib/devOverrides')

const TICK_MS = 5000
const SUPPORTERS_URL = 'https://cms.mat.dog/getSupporters'

const send = (...args) => ipc.send('toWindow', args)

class Player {
  constructor ({ dataPath, version }) {
    this.version = version
    this.settings = new Settings(dataPath)
    this.engine = new AudioEngine()
    this.engine.music.setVolume(this.settings.soundVol / 100)
    this.engine.rain.setVolume(this.settings.rainVol / 100)
    this.tune = new TownTune(this.settings.soundVol / 100)
    this.library = new Library({
      dir: dataPath,
      preferNoDownload: () => this.settings.preferNoDownload,
      onDownloaded: kind => send('downloadDone', kind),
      onRemoved: kind => send('downloadRemoved', kind)
    })
    this.weather = new WeatherService({
      getKey: () => this.settings.weatherApiCode,
      onReport: report => this.onWeather(report),
      onError: key => send('weatherError', key),
      fetchImpl: dev.fetchImpl,
      now
    })
    this.hour = null
    this.current = null // { game, track } of the music channel
    this.queue = Promise.resolve()
  }

  async start () {
    const counts = Library.counts(await this.settings.keys())
    const showChangelog = this.settings.latestVersion !== this.version
    if (showChangelog) this.settings.set('latestVersion', this.version)
    send('configs', {
      ...this.settings.snapshot(),
      offlineFiles: counts.hourly,
      offlineKKFiles: counts.kk,
      totalFiles: games.totalHourlyTracks(),
      totalKKFiles: games.kkSongs.length,
      showChangelog
    })
    this.loadSupporters()
    if (this.settings.useRealtimeWeather) this.weather.start()
    this.syncRain()
    this.tick()
    setInterval(() => this.tick(), TICK_MS)
  }

  /** Audio changes are serialised so a tick never races a user action. */
  run (fn) {
    this.queue = this.queue.then(fn, fn).catch(err => logger.error('player', err))
    return this.queue
  }

  tick () {
    if (this.settings.paused) return
    return this.run(() => this.update())
  }

  weatherMusic () {
    return this.settings.useRealtimeWeather ? this.weather.music : undefined
  }

  /** Works out what should be playing and switches to it if needed. */
  async update ({ force = false } = {}) {
    if (this.settings.paused) return
    const date = now()
    const hour = games.hourLabel(date)
    const hourChanged = this.hour !== null && this.hour !== hour
    this.hour = hour

    const game = games.resolveGame({
      selected: this.settings.game,
      weather: this.weatherMusic(),
      kkSaturday: this.settings.kkSaturday,
      date
    })

    if (game === games.KK_GAME) {
      const kkPlaying = this.current && this.current.game === games.KK_GAME && this.engine.music.playing
      if (kkPlaying && !force) return
      return this.play(games.KK_GAME, games.pickKKSong(this.settings.kkEnabled))
    }

    const track = games.trackForHour(game, hour)
    const same = this.current && this.current.game === game && this.current.track === track
    if (same && !force) return

    await this.engine.music.stop()
    if (hourChanged && this.settings.tuneEnabled) await this.tune.playChime(this.settings.tune)
    await this.play(game, track)
  }

  async play (game, track) {
    let location
    try {
      location = dev.resolveTrack ? await dev.resolveTrack() : await this.library.resolve(game, track)
    } catch (err) {
      if (err instanceof LibraryError) return send('error', err.key)
      throw err
    }
    let buffer
    try {
      buffer = await this.engine.decode(location)
    } catch (err) {
      logger.error(`could not decode ${location}: ${err.message}`)
      if (!this.settings.preferNoDownload) await this.library.removeCorrupt(game, track)
      return send('error', 'failedToLoadSound')
    }
    if (this.settings.paused) return

    const isKK = game === games.KK_GAME
    this.current = { game, track }
    await this.engine.music.play(buffer, {
      loop: !isKK && !this.settings.grandFather,
      onEnded: isKK ? () => this.tick() : null
    })
    this.announce()
  }

  announce () {
    const { game, track } = this.current
    ipc.send('playing', [games.humanGameName(game), track])
    send('nowPlaying', { game, track })
  }

  // ---- rain -------------------------------------------------------------

  canPlayRain () {
    if (!this.settings.useRealtimeWeather || !this.weather.report) return true
    return this.weather.music === 'rainy'
  }

  rainTrack () {
    if (this.settings.gameRain) return 'game-rain'
    if (this.settings.peacefulRain) return 'no-thunder-rain'
    return 'rain'
  }

  syncRain ({ restart = false } = {}) {
    return this.run(async () => {
      if (this.settings.paused || !this.canPlayRain()) return this.engine.rain.stop()
      if (this.engine.rain.playing && !restart) return
      await this.engine.rain.stop()
      try {
        const location = dev.resolveTrack ? await dev.resolveTrack() : await this.library.resolve(RAIN_GAME, this.rainTrack())
        const buffer = await this.engine.decode(location)
        await this.engine.rain.play(buffer, { loop: !this.settings.grandFather })
      } catch (err) {
        logger.error(`rain: ${err.message}`)
        send('error', err instanceof LibraryError ? err.key : 'failedToLoadRainSound')
      }
    })
  }

  // ---- weather ----------------------------------------------------------

  onWeather (report) {
    send('weather', report)
    this.syncRain()
    this.tick()
  }

  setRealtimeWeather (enabled) {
    this.settings.set('useRealtimeWeather', enabled)
    if (enabled) {
      this.weather.start()
    } else {
      this.weather.stop()
      send('weather', null)
    }
    this.syncRain()
    this.tick()
  }

  // ---- pause ------------------------------------------------------------

  setPaused (paused) {
    this.settings.set('paused', paused)
    if (paused) {
      this.current = null
      ipc.send('playing', [])
      send('nowPlaying', null)
      return this.run(() => Promise.all([this.engine.music.stop(), this.engine.rain.stop()]))
    }
    this.hour = null
    this.syncRain()
    return this.tick()
  }

  // ---- downloads --------------------------------------------------------

  async downloadAll (entries) {
    const ok = await this.library.downloadAll(entries, percent => send('bar', percent))
    if (!ok) send('error', 'failedToDownload')
    send('downloadDoneAll')
    send('bar', 100)
  }

  loadSupporters () {
    superagent.get(SUPPORTERS_URL)
      .then(res => send('patreon', res.text ? JSON.parse(res.text) : []))
      .catch(() => send('patreon', []))
  }

  // ---- commands from the window ----------------------------------------

  handle (command, ...args) {
    const [value] = args
    const settings = this.settings
    const handlers = {
      musicVol: () => {
        settings.set('soundVol', +value)
        this.engine.music.setVolume(+value / 100)
        this.tune.setVolume(+value / 100)
      },
      rainVol: () => {
        settings.set('rainVol', +value)
        this.engine.rain.setVolume(+value / 100)
      },
      grandFather: () => {
        settings.set('grandFather', value)
        const isKK = this.current && this.current.game === games.KK_GAME
        this.engine.music.setLoop(!value && !isKK)
        this.engine.rain.setLoop(!value)
        if (!value && !this.engine.music.playing) this.run(() => this.update({ force: true }))
      },
      game: () => {
        settings.set('game', value)
        this.tick()
      },
      tuneEnabled: () => settings.set('tuneEnabled', value),
      preferNoDownload: () => settings.set('preferNoDownload', value),
      tune: () => settings.set('tune', value),
      lang: () => settings.set('lang', value),
      tempUnit: () => settings.set('tempUnit', value),
      openOnStartup: () => {
        settings.set('openOnStartup', value)
        ipc.send('openOnStartup', [value])
      },
      kkSaturday: () => {
        settings.set('kkSaturday', value)
        this.tick()
      },
      kkEnabled: () => {
        settings.set('kkEnabled', value)
        const playingDisabled = this.current && this.current.game === games.KK_GAME && !value.includes(this.current.track)
        if (playingDisabled) this.run(() => this.update({ force: true }))
      },
      skipKK: () => {
        if (this.current && this.current.game === games.KK_GAME) this.run(() => this.update({ force: true }))
      },
      playNote: () => this.tune.playBeep(value, 350),
      playTune: () => this.tune.playBeeps(value),
      paused: () => this.setPaused(value),
      pauseIfPlaying: () => {
        if (settings.paused) return
        this.setPaused(true)
        send('pause')
      },
      downloadHourly: () => this.downloadAll(Library.hourlyEntries()),
      downloadKK: () => this.downloadAll(Library.kkEntries()),
      gameRain: () => {
        settings.set('gameRain', value)
        settings.set('peacefulRain', false)
        this.syncRain({ restart: true })
      },
      peacefulRain: () => {
        settings.set('peacefulRain', value)
        settings.set('gameRain', false)
        this.syncRain({ restart: true })
      },
      useRealtimeWeather: () => this.setRealtimeWeather(value),
      weatherApiCode: () => {
        settings.set('weatherApiCode', (value || '').trim())
        if (settings.useRealtimeWeather) this.weather.refresh()
      },
      refreshWeather: () => {
        if (settings.useRealtimeWeather) this.weather.refresh()
      }
    }
    const handler = handlers[command]
    if (!handler) return logger.warn(`unknown player command ${command}`)
    return handler()
  }
}

let player = null

ipc.on('toPlayer', (event, [command, ...args]) => {
  if (command === 'userSettingsPath') {
    if (player) return
    player = new Player({ dataPath: args[0], version: args[1] })
    player.start()
    return
  }
  if (player) player.handle(command, ...args)
})

ipc.send('playerLoaded')
