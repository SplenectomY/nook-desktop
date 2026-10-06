/** Anonymous page-view counter (Google Analytics measurement protocol). */
const request = require('superagent')
const uuid = require('uuid')
const i18n = require('./i18n')

const session = uuid.v4()

const logVisit = page => {
  request
    .post('https://www.google-analytics.com/mp/collect')
    .query({ api_secret: 'V8GvDmXcQmWaAM6HGa0nDg', measurement_id: 'G-3Y8P169K9E' })
    .send(JSON.stringify({
      client_id: session,
      user_properties: { language: { value: i18n.getLanguage() } },
      events: [{
        name: 'page_view',
        params: {
          page_title: page,
          page_location: `https://mat.dog/nook/${page}`,
          engagement_time_msec: '5',
          session_id: session
        }
      }]
    }))
    .then(() => {})
    .catch(() => {})
}

module.exports = { logVisit }
