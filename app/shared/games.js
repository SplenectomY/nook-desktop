/**
 * The catalogue of hourly soundtracks Nook can play and the rules that decide
 * which one should be playing right now.
 */
const kkSongs = require('./kk.json')

const KK_GAME = 'kk-slider-desktop'
const RANDOM = 'random'

const HOURS = [
  '12am', '1am', '2am', '3am', '4am', '5am', '6am', '7am', '8am', '9am', '10am', '11am',
  '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm', '11pm'
]

const POCKET_CAMP_PERIODS = ['morning', 'day', 'evening', 'night']

/**
 * Every game is a member of a family (the actual game) and a weather flavour.
 * `cherry` is treated as fair weather when matching against the real forecast.
 */
const GAMES = {
  'population-growing': { family: 'population-growing', weather: 'sunny', label: 'Population Growing' },
  'population-growing-snowy': { family: 'population-growing', weather: 'snowy', label: 'Population Growing (Snowy)' },
  'population-growing-cherry': { family: 'population-growing', weather: 'cherry', label: 'Population Growing (Sakura)' },
  'population-growing-rainy': { family: 'population-growing', weather: 'rainy', label: 'Population Growing (Rainy)', fixedTrack: '12am' },
  'wild-world': { family: 'wild-world', weather: 'sunny', label: 'City Folk' },
  'wild-world-rainy': { family: 'wild-world', weather: 'rainy', label: 'City Folk (Rainy)' },
  'wild-world-snowy': { family: 'wild-world', weather: 'snowy', label: 'City Folk (Snowy)' },
  'new-leaf': { family: 'new-leaf', weather: 'sunny', label: 'New Leaf' },
  'new-leaf-rainy': { family: 'new-leaf', weather: 'rainy', label: 'New Leaf (Rainy)' },
  'new-leaf-snowy': { family: 'new-leaf', weather: 'snowy', label: 'New Leaf (Snowy)' },
  'new-horizons': { family: 'new-horizons', weather: 'sunny', label: 'New Horizons' },
  'new-horizons-rainy': { family: 'new-horizons', weather: 'rainy', label: 'New Horizons (Rainy)' },
  'new-horizons-snowy': { family: 'new-horizons', weather: 'snowy', label: 'New Horizons (Snowy)' },
  'pocket-camp': { family: 'pocket-camp', weather: 'sunny', label: 'Pocket Camp', periods: POCKET_CAMP_PERIODS }
}

const GAME_IDS = Object.keys(GAMES)

const isGame = id => Object.prototype.hasOwnProperty.call(GAMES, id)

/** '3pm' style hour label used by the CDN file names. */
const hourLabel = date => {
  const hrs = date.getHours()
  return `${hrs % 12 || 12}${hrs >= 12 ? 'pm' : 'am'}`
}

/** Pocket Camp only has four tracks a day. */
const pocketCampPeriod = hour => {
  const index = HOURS.indexOf(hour)
  if (index >= 5 && index <= 8) return 'morning'
  if (index >= 9 && index <= 16) return 'day'
  if (index >= 17 && index <= 18) return 'evening'
  return 'night'
}

/** The track name (file name without extension) a game plays at a given hour. */
const trackForHour = (gameId, hour) => {
  const game = GAMES[gameId]
  if (!game) return hour
  if (game.fixedTrack) return game.fixedTrack
  if (game.periods) return pocketCampPeriod(hour)
  return hour
}

/** Every track a game has, used by the offline downloader. */
const tracksForGame = gameId => (GAMES[gameId] && GAMES[gameId].periods) || HOURS

const totalHourlyTracks = () => GAME_IDS.reduce((sum, id) => sum + tracksForGame(id).length, 0)

/** K.K. plays on Saturday nights from 8pm until midnight. */
const isKKNight = date => date.getDay() === 6 && date.getHours() >= 20

const weatherMatches = (gameWeather, weather) => {
  if (!weather) return true
  if (weather === 'sunny') return gameWeather === 'sunny' || gameWeather === 'cherry'
  return gameWeather === weather
}

const pick = (list, random = Math.random) => list[Math.floor(random() * list.length)]

/**
 * Finds the flavour of a game family that fits the given weather, falling
 * back to the user's own choice when the family has no such flavour.
 */
const weatherVariant = (gameId, weather) => {
  const game = GAMES[gameId]
  if (!game || !weather || weatherMatches(game.weather, weather)) return gameId
  const match = GAME_IDS.find(id => GAMES[id].family === game.family && weatherMatches(GAMES[id].weather, weather))
  return match || gameId
}

/**
 * Decides which soundtrack should actually play.
 *
 * @param {object} state
 * @param {string} state.selected   game chosen in the dropdown (may be 'random' or the K.K. game)
 * @param {string} [state.weather]  'sunny' | 'rainy' | 'snowy' when realtime weather is on
 * @param {boolean} [state.kkSaturday] whether K.K. takes over on Saturday nights
 * @param {Date} [state.date]
 * @param {Function} [state.random]
 */
const resolveGame = ({ selected, weather, kkSaturday = false, date = new Date(), random = Math.random }) => {
  if (kkSaturday && isKKNight(date)) return KK_GAME
  if (selected === KK_GAME) return KK_GAME
  if (selected === RANDOM) {
    const candidates = GAME_IDS.filter(id => weatherMatches(GAMES[id].weather, weather))
    return pick(candidates.length ? candidates : GAME_IDS, random)
  }
  if (!isGame(selected)) return weatherVariant('new-leaf', weather)
  return weatherVariant(selected, weather)
}

/** Picks a K.K. song from the enabled list, falling back to the full catalogue. */
const pickKKSong = (enabled, random = Math.random) => {
  const list = Array.isArray(enabled) && enabled.length ? enabled : kkSongs
  return pick(list, random)
}

/** "new-leaf-rainy" -> "New Leaf Rainy", used for the tray tooltip. */
const humanGameName = gameId => gameId.replace('kk-slider-desktop', 'kk-slider').split('-')
  .map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')

module.exports = {
  KK_GAME,
  RANDOM,
  HOURS,
  GAMES,
  GAME_IDS,
  kkSongs,
  isGame,
  hourLabel,
  pocketCampPeriod,
  trackForHour,
  tracksForGame,
  totalHourlyTracks,
  isKKNight,
  weatherVariant,
  resolveGame,
  pickKKSong,
  humanGameName
}
