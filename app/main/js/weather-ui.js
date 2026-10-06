/**
 * Renders the weather strip on the home page and the full report page from
 * the compact report the player sends.
 */
const $ = window.jQuery
const i18n = require('./i18n')
const { icon } = require('./weather-icons')

const state = {
  enabled: false,
  hasKey: false,
  unit: 'c',
  report: null,
  error: null
}

const temp = (c, f) => `${state.unit === 'f' ? f : c}°`

const dayName = (date, index) => {
  if (index === 0) return i18n.t('today')
  if (index === 1) return i18n.t('tomorrow')
  return new Date(`${date}T12:00:00`).toLocaleDateString(i18n.getLocale(), { weekday: 'short' })
}

const hourName = epoch => new Date(epoch * 1000).toLocaleTimeString(i18n.getLocale(), { hour: 'numeric' })

const clock = ms => new Date(ms).toLocaleTimeString(i18n.getLocale(), { hour: 'numeric', minute: '2-digit' })

const location = loc => [loc.name, loc.region || loc.country].filter(Boolean).join(', ')

const renderStrip = () => {
  const strip = $('#weatherStrip')
  const report = state.report
  strip.toggleClass('on', Boolean(report)).toggleClass('off', !report)
  if (!report) {
    strip.find('.strip-temp').text('')
    strip.find('.strip-text').text(i18n.t(offMessage()))
    return
  }
  strip.find('.strip-icon').html(icon(report.current.condition.icon))
  strip.find('.strip-temp').text(temp(report.current.tempC, report.current.tempF))
  strip.find('.strip-text').text(`${report.current.condition.text} · ${report.location.name}`)
}

const offMessage = () => {
  if (!state.enabled) return 'realtime weather is off'
  if (!state.hasKey) return 'weatherErrorNoKey'
  return state.error || 'weather is loading...'
}

const renderDetails = report => {
  const c = report.current
  const today = report.days[0] || {}
  const tiles = [
    ['feels like', temp(c.feelsC, c.feelsF)],
    ['humidity', `${c.humidity}%`],
    ['wind', state.unit === 'f' ? `${c.windMph} mph ${c.windDir}` : `${c.windKph} km/h ${c.windDir}`],
    ['uv index', c.uv],
    ['precipitation', state.unit === 'f' ? `${c.precipIn} in` : `${c.precipMm} mm`],
    ['sunrise / sunset', today.sunrise && today.sunset ? `${today.sunrise.replace(/^0/, '')}<br>${today.sunset.replace(/^0/, '')}` : '–']
  ]
  $('.weather-details').html(tiles.map(([label, value]) =>
    `<div class="tile"><div class="tile-label">${i18n.t(label)}</div><div class="tile-value">${value}</div></div>`
  ).join(''))
}

const renderHours = report => {
  $('.weather-hours').html(report.hours.map((h, index) => {
    const chance = Math.max(h.chanceRain, h.chanceSnow)
    return `<div class="hour">
      <div class="hour-time">${index === 0 ? i18n.t('now') : hourName(h.epoch)}</div>
      ${icon(h.condition.icon)}
      <div class="hour-temp">${temp(h.tempC, h.tempF)}</div>
      <div class="hour-rain">${chance >= 20 ? `${chance}%` : '&nbsp;'}</div>
    </div>`
  }).join(''))
}

const renderDays = report => {
  $('.weather-days').html(report.days.map((d, index) => {
    const snowy = d.chanceSnow > d.chanceRain
    const chance = snowy ? d.chanceSnow : d.chanceRain
    const chanceText = chance >= 20 ? `${i18n.t(snowy ? 'chance of snow' : 'chance of rain')} ${chance}%` : ''
    return `<div class="day">
      <div class="day-name">${dayName(d.date, index)}</div>
      ${icon(d.condition.icon)}
      <div class="day-cond">${d.condition.text}<span class="day-rain">${chanceText}</span></div>
      <div class="day-temps">${temp(d.maxC, d.maxF)} <span class="lo">${temp(d.minC, d.minF)}</span></div>
    </div>`
  }).join(''))
}

const renderPage = () => {
  const report = state.report
  $('.unit-toggle button').removeClass('active').filter(`[data-unit="${state.unit}"]`).addClass('active')
  $('.weather-off').toggleClass('hidden', Boolean(report))
  $('.weather-body').toggleClass('hidden', !report)
  if (!report) {
    $('.weather-off-text').text(i18n.t(offMessage()))
    $('.weather-off-btn').toggleClass('hidden', state.enabled && state.hasKey)
    return
  }
  $('.now-icon').html(icon(report.current.condition.icon))
  $('.now-temp').text(temp(report.current.tempC, report.current.tempF))
  $('.now-cond').text(report.current.condition.text)
  $('.now-loc').text(location(report.location))
  $('.weather-music-text').text(i18n.t('nook is playing {{music}} music', { music: i18n.t(`${report.music} music`) }))
  renderDetails(report)
  renderHours(report)
  renderDays(report)
  $('.weather-updated').text(i18n.t('updated {{time}} · powered by WeatherAPI.com', { time: clock(report.updatedAt) }))
}

const render = () => {
  renderStrip()
  renderPage()
}

const setReport = report => {
  state.report = report
  state.error = null
  render()
}

const setError = key => {
  state.error = key
  if (key === 'weatherErrorNoKey' || key === 'weatherErrorKey') state.report = null
  render()
}

const configure = ({ enabled, hasKey, unit }) => {
  if (enabled !== undefined) state.enabled = enabled
  if (hasKey !== undefined) state.hasKey = hasKey
  if (unit !== undefined) state.unit = unit
  if (!state.enabled) state.report = null
  render()
}

module.exports = { configure, setReport, setError, render, state }
