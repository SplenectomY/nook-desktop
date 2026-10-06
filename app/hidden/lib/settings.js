/**
 * Persistent user settings. The storage keys and shapes are kept identical to
 * earlier releases so existing installs keep their configuration.
 */
const storage = require('electron-json-storage')
const { kkSongs } = require('../../shared/games')

const DEFAULT_TUNE = ['G1', 'E2', '-', 'G1', 'F1', 'D2', '-', 'B2', 'C2', 'zZz', '?', 'zZz', 'C1', '-', 'zZz', 'zZz']

const fahrenheitLocales = ['en-US', 'en-LR', 'en-MM', 'en-BS', 'en-BZ', 'en-KY', 'en-PW']
const defaultTempUnit = () => {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    return fahrenheitLocales.includes(locale) ? 'f' : 'c'
  } catch (err) {
    return 'c'
  }
}

/** name -> { key: storage file, prop: property inside it, def: default } */
const SCHEMA = {
  soundVol: { key: 'soundVol', prop: 'volume', def: 50 },
  rainVol: { key: 'rainVol', prop: 'volume', def: 50 },
  grandFather: { key: 'grandFather', prop: 'enabled', def: false },
  game: { key: 'game', prop: 'game', def: 'new-leaf' },
  lang: { key: 'lang', prop: 'lang', def: 'en' },
  tuneEnabled: { key: 'tuneEnabled', prop: 'tuneEnabled', def: true },
  preferNoDownload: { key: 'preferNoDownload', prop: 'preferNoDownload', def: false },
  tune: { key: 'tune', prop: 'tune', def: DEFAULT_TUNE },
  paused: { key: 'paused', prop: 'paused', def: false },
  gameRain: { key: 'gameRain', prop: 'enabled', def: false },
  peacefulRain: { key: 'peacefulRain', prop: 'enabled', def: false },
  kkEnabled: { key: 'kkEnabled', prop: 'songs', def: kkSongs },
  kkSaturday: { key: 'kkSaturday', prop: 'enabled', def: false },
  openOnStartup: { key: 'openOnStartup', prop: 'enabled', def: false },
  latestVersion: { key: 'latestVersion', prop: 'version', def: null },
  useRealtimeWeather: { key: 'useRealtimeWeather', prop: 'enabled', def: false },
  weatherApiCode: { key: 'weatherApiCode', prop: 'code', def: '' },
  tempUnit: { key: 'tempUnit', prop: 'unit', def: defaultTempUnit() }
}

const read = ({ key, prop, def }) => {
  const raw = storage.getSync(key)
  // An earlier release stored the API code as a bare string.
  if (typeof raw === 'string') return raw
  if (raw && raw[prop] !== undefined && raw[prop] !== null) return raw[prop]
  return def
}

class Settings {
  constructor (dataPath) {
    storage.setDataPath(dataPath)
    this.dataPath = dataPath
    for (const name of Object.keys(SCHEMA)) this[name] = read(SCHEMA[name])
    if (!Array.isArray(this.kkEnabled)) this.kkEnabled = kkSongs
    if (!Array.isArray(this.tune) || this.tune.length !== 16) this.tune = DEFAULT_TUNE
  }

  /** Updates a value in memory and on disk. */
  set (name, value) {
    const entry = SCHEMA[name]
    if (!entry) throw new Error(`unknown setting ${name}`)
    this[name] = value
    storage.set(entry.key, { [entry.prop]: value }, err => {
      if (err) console.error(`could not save ${name}`, err)
    })
  }

  /** Everything the window needs to render itself. */
  snapshot () {
    const out = {}
    for (const name of Object.keys(SCHEMA)) out[name] = this[name]
    return out
  }

  keys () {
    return new Promise(resolve => storage.keys((err, keys) => resolve(err ? [] : keys)))
  }
}

module.exports = { Settings, DEFAULT_TUNE }
