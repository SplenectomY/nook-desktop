/**
 * Development hooks, all opt-in through environment variables, that let the
 * app run without network access (e.g. while taking screenshots):
 *
 *   NOOK_WEATHER_FIXTURE=/path/to/weatherapi-forecast.json
 *   NOOK_AUDIO_FIXTURE=/path/to/any.ogg   plays this file for every track
 *   NOOK_FAKE_TIME=2026-10-10T21:30      see shared/clock.js
 */
const fs = require('fs')

const weatherFixture = process.env.NOOK_WEATHER_FIXTURE
const audioFixture = process.env.NOOK_AUDIO_FIXTURE

const fetchImpl = weatherFixture
  ? async () => ({ ok: true, status: 200, json: async () => JSON.parse(await fs.promises.readFile(weatherFixture, 'utf8')) })
  : (...args) => fetch(...args)

const resolveTrack = audioFixture ? async () => audioFixture : null

module.exports = { fetchImpl, resolveTrack, active: Boolean(weatherFixture || audioFixture) }
