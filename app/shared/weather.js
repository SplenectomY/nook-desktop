/**
 * Pure helpers that turn a WeatherAPI.com forecast response into the compact
 * report the UI renders, and map conditions onto the music Nook should play.
 */
const codes = require('./weatherCodes.json')

const MUSIC_BY_CODE = codes.reduce((acc, entry) => {
  acc[entry.code] = (entry.music || 'Sunny').toLowerCase()
  return acc
}, {})

/** 'sunny' | 'rainy' | 'snowy' for a WeatherAPI condition code. */
const musicForCode = code => MUSIC_BY_CODE[code] || 'sunny'

/**
 * Groups the ~48 WeatherAPI condition codes into the handful of icons Nook
 * draws itself (so the forecast works offline and matches the app's look).
 */
const iconForCode = (code, isDay = true) => {
  const day = isDay ? 'day' : 'night'
  if (code === 1000) return isDay ? 'sunny' : 'clear-night'
  if (code === 1003) return `partly-cloudy-${day}`
  if (code === 1006) return 'cloudy'
  if (code === 1009) return 'overcast'
  if ([1030, 1135, 1147].includes(code)) return 'fog'
  if ([1087, 1273, 1276, 1279, 1282].includes(code)) return 'thunder'
  if ([1066, 1069, 1072, 1114, 1117, 1168, 1171, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264].includes(code)) {
    return [1114, 1117, 1222, 1225, 1258].includes(code) ? 'heavy-snow' : 'snow'
  }
  if ([1063, 1150, 1153, 1180, 1183, 1240].includes(code)) return 'drizzle'
  return 'rain'
}

const round = n => Math.round(Number(n) || 0)

const condition = (c, isDay) => ({
  text: c.text,
  code: c.code,
  icon: iconForCode(c.code, isDay)
})

/**
 * @param {object} json  raw WeatherAPI forecast.json body
 * @param {Date} [now]   used to pick the "next hours" window
 */
const buildReport = (json, now = new Date()) => {
  if (!json || !json.current || !json.location) throw new Error('malformed weather response')
  const current = json.current
  const isDay = current.is_day === 1 || current.is_day === true
  const days = ((json.forecast && json.forecast.forecastday) || []).map(day => ({
    date: day.date,
    maxC: round(day.day.maxtemp_c),
    maxF: round(day.day.maxtemp_f),
    minC: round(day.day.mintemp_c),
    minF: round(day.day.mintemp_f),
    chanceRain: round(day.day.daily_chance_of_rain),
    chanceSnow: round(day.day.daily_chance_of_snow),
    condition: condition(day.day.condition, true),
    sunrise: day.astro && day.astro.sunrise,
    sunset: day.astro && day.astro.sunset
  }))

  // The next twelve hours, straddling midnight if needed.
  const hours = []
  const cutoff = now.getTime() - 60 * 60 * 1000
  for (const day of (json.forecast && json.forecast.forecastday) || []) {
    for (const h of day.hour || []) {
      if (h.time_epoch * 1000 < cutoff) continue
      if (hours.length >= 12) break
      hours.push({
        epoch: h.time_epoch,
        tempC: round(h.temp_c),
        tempF: round(h.temp_f),
        chanceRain: round(h.chance_of_rain),
        chanceSnow: round(h.chance_of_snow),
        condition: condition(h.condition, h.is_day === 1)
      })
    }
  }

  return {
    updatedAt: now.getTime(),
    location: {
      name: json.location.name,
      region: json.location.region,
      country: json.location.country,
      localtime: json.location.localtime
    },
    current: {
      tempC: round(current.temp_c),
      tempF: round(current.temp_f),
      feelsC: round(current.feelslike_c),
      feelsF: round(current.feelslike_f),
      humidity: round(current.humidity),
      windKph: round(current.wind_kph),
      windMph: round(current.wind_mph),
      windDir: current.wind_dir,
      uv: Number(current.uv) || 0,
      precipMm: Number(current.precip_mm) || 0,
      precipIn: Number(current.precip_in) || 0,
      cloud: round(current.cloud),
      isDay,
      condition: condition(current.condition, isDay)
    },
    music: musicForCode(current.condition.code),
    days,
    hours
  }
}

/**
 * Maps a WeatherAPI error (HTTP status + body) to one of Nook's i18n keys.
 * https://www.weatherapi.com/docs/#intro-error-codes
 */
const errorKey = (status, body) => {
  const code = body && body.error && body.error.code
  if ([1002, 2006, 2008].includes(code) || status === 401) return 'weatherErrorKey'
  if (code === 2007 || status === 403) return 'weatherErrorQuota'
  if (code === 1006) return 'weatherErrorLocation'
  return 'weatherErrorGeneric'
}

module.exports = { musicForCode, iconForCode, buildReport, errorKey }
