/**
 * Fetches the local forecast from WeatherAPI.com and keeps it fresh.
 */
const logger = require('electron-log')
const { buildReport, errorKey } = require('../../shared/weather')

const REFRESH_MS = 15 * 60 * 1000
const ENDPOINT = 'https://api.weatherapi.com/v1/forecast.json'

class WeatherService {
  /**
   * @param {object} opts
   * @param {Function} opts.getKey    returns the user's API key
   * @param {Function} opts.onReport  (report) after each successful refresh
   * @param {Function} opts.onError   (i18nKey) when a refresh fails
   * @param {Function} [opts.fetchImpl]
   * @param {Function} [opts.now]
   */
  constructor ({ getKey, onReport, onError, fetchImpl = fetch, now = () => new Date() }) {
    this.getKey = getKey
    this.onReport = onReport
    this.onError = onError
    this.fetchImpl = fetchImpl
    this.now = now
    this.report = null
    this.timer = null
    this.inFlight = null
  }

  /** 'sunny' | 'rainy' | 'snowy' | undefined when nothing is known yet. */
  get music () {
    return this.report ? this.report.music : undefined
  }

  start () {
    this.stop()
    this.timer = setInterval(() => this.refresh(), REFRESH_MS)
    return this.refresh()
  }

  stop () {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.report = null
  }

  /** Fetches a fresh forecast. Resolves to true on success. */
  refresh () {
    if (!this.inFlight) {
      this.inFlight = this.doRefresh().finally(() => { this.inFlight = null })
    }
    return this.inFlight
  }

  async doRefresh () {
    const key = this.getKey()
    if (!key) {
      this.report = null
      this.onError('weatherErrorNoKey')
      return false
    }
    const url = `${ENDPOINT}?key=${encodeURIComponent(key)}&q=auto:ip&days=3&aqi=no&alerts=no`
    let response
    let body
    try {
      response = await this.fetchImpl(url)
      body = await response.json()
    } catch (err) {
      logger.warn('weather request failed', err && err.message)
      this.onError('weatherErrorOffline')
      return false
    }
    if (!response.ok) {
      logger.warn('weather api error', response.status, body && body.error)
      this.report = null
      this.onError(errorKey(response.status, body))
      return false
    }
    try {
      this.report = buildReport(body, this.now())
    } catch (err) {
      logger.warn('weather response unusable', err.message)
      this.onError('weatherErrorGeneric')
      return false
    }
    logger.info(`weather: ${this.report.location.name}, ${this.report.current.condition.text} -> ${this.report.music}`)
    this.onReport(this.report)
    return true
  }
}

module.exports = { WeatherService, REFRESH_MS }
