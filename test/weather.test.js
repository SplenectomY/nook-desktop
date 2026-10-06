const test = require('node:test')
const assert = require('node:assert/strict')
const weather = require('../app/shared/weather')
const fixture = require('./fixtures/weatherapi-forecast.json')

test('every condition code maps to music', () => {
  const codes = require('../app/shared/weatherCodes.json')
  for (const entry of codes) {
    assert.ok(['sunny', 'rainy', 'snowy'].includes(weather.musicForCode(entry.code)), `code ${entry.code}`)
  }
  assert.equal(weather.musicForCode(1168), 'rainy', 'freezing drizzle used to be unmapped')
  assert.equal(weather.musicForCode(999999), 'sunny')
})

test('icons depend on day and night', () => {
  assert.equal(weather.iconForCode(1000, true), 'sunny')
  assert.equal(weather.iconForCode(1000, false), 'clear-night')
  assert.equal(weather.iconForCode(1003, false), 'partly-cloudy-night')
  assert.equal(weather.iconForCode(1195), 'rain')
  assert.equal(weather.iconForCode(1225), 'heavy-snow')
  assert.equal(weather.iconForCode(1087), 'thunder')
})

test('buildReport condenses the forecast', () => {
  const now = new Date('2026-10-10T21:30:00')
  const report = weather.buildReport(fixture, now)
  assert.equal(report.location.name, 'Burlington')
  assert.equal(report.current.tempC, 12)
  assert.equal(report.current.tempF, 54)
  assert.equal(report.current.isDay, false)
  assert.equal(report.music, 'rainy')
  assert.equal(report.days.length, 3)
  assert.equal(report.days[2].chanceSnow, 70)
  assert.equal(report.hours.length, 12)
  // the first hour is the current one, the window crosses midnight
  assert.equal(new Date(report.hours[0].epoch * 1000).getHours(), 21)
  assert.equal(new Date(report.hours[11].epoch * 1000).getHours(), 8)
})

test('buildReport rejects garbage', () => {
  assert.throws(() => weather.buildReport({}), /malformed/)
})

test('error keys follow the WeatherAPI error codes', () => {
  assert.equal(weather.errorKey(401, { error: { code: 2006 } }), 'weatherErrorKey')
  assert.equal(weather.errorKey(403, { error: { code: 2007 } }), 'weatherErrorQuota')
  assert.equal(weather.errorKey(400, { error: { code: 1006 } }), 'weatherErrorLocation')
  assert.equal(weather.errorKey(500, null), 'weatherErrorGeneric')
})
