const test = require('node:test')
const assert = require('node:assert/strict')
const games = require('../app/shared/games')

test('hourLabel formats the CDN style hour', () => {
  assert.equal(games.hourLabel(new Date(2026, 0, 1, 0)), '12am')
  assert.equal(games.hourLabel(new Date(2026, 0, 1, 9)), '9am')
  assert.equal(games.hourLabel(new Date(2026, 0, 1, 12)), '12pm')
  assert.equal(games.hourLabel(new Date(2026, 0, 1, 23)), '11pm')
})

test('pocket camp collapses hours into four periods', () => {
  assert.equal(games.trackForHour('pocket-camp', '6am'), 'morning')
  assert.equal(games.trackForHour('pocket-camp', '1pm'), 'day')
  assert.equal(games.trackForHour('pocket-camp', '5pm'), 'evening')
  assert.equal(games.trackForHour('pocket-camp', '2am'), 'night')
})

test('population growing rainy always plays the same track', () => {
  assert.equal(games.trackForHour('population-growing-rainy', '3pm'), '12am')
  assert.equal(games.trackForHour('new-leaf', '3pm'), '3pm')
})

test('total hourly track count matches the offline counter', () => {
  assert.equal(games.totalHourlyTracks(), 13 * 24 + 4)
})

test('K.K. night is Saturday from 8pm', () => {
  assert.equal(games.isKKNight(new Date(2026, 9, 10, 20, 0)), true) // Saturday 8pm
  assert.equal(games.isKKNight(new Date(2026, 9, 10, 19, 59)), false)
  assert.equal(games.isKKNight(new Date(2026, 9, 11, 0, 0)), false) // Sunday
})

test('resolveGame switches to the weather flavour of the chosen family', () => {
  assert.equal(games.resolveGame({ selected: 'new-leaf', weather: 'rainy' }), 'new-leaf-rainy')
  assert.equal(games.resolveGame({ selected: 'new-leaf-snowy', weather: 'sunny' }), 'new-leaf')
  assert.equal(games.resolveGame({ selected: 'new-horizons-rainy', weather: 'snowy' }), 'new-horizons-snowy')
  assert.equal(games.resolveGame({ selected: 'pocket-camp', weather: 'rainy' }), 'pocket-camp', 'no rainy flavour: keep choice')
  assert.equal(games.resolveGame({ selected: 'population-growing-cherry', weather: 'sunny' }), 'population-growing-cherry', 'cherry counts as fair weather')
  assert.equal(games.resolveGame({ selected: 'population-growing-cherry', weather: 'rainy' }), 'population-growing-rainy')
})

test('resolveGame leaves the choice alone without weather', () => {
  assert.equal(games.resolveGame({ selected: 'new-leaf-snowy' }), 'new-leaf-snowy')
  assert.equal(games.resolveGame({ selected: 'garbage' }), 'new-leaf')
})

test('random mode only picks games that fit the weather', () => {
  for (let i = 0; i < 25; i++) {
    const id = games.resolveGame({ selected: 'random', weather: 'snowy' })
    assert.equal(games.GAMES[id].weather, 'snowy')
  }
  const sunny = games.resolveGame({ selected: 'random', weather: 'sunny', random: () => 0 })
  assert.equal(sunny, 'population-growing')
})

test('K.K. takes over on Saturday nights when enabled', () => {
  const date = new Date(2026, 9, 10, 21, 0)
  assert.equal(games.resolveGame({ selected: 'new-leaf', kkSaturday: true, date }), games.KK_GAME)
  assert.equal(games.resolveGame({ selected: 'new-leaf', kkSaturday: false, date }), 'new-leaf')
})

test('pickKKSong falls back to the full catalogue when nothing is enabled', () => {
  assert.equal(games.pickKKSong([], () => 0), games.kkSongs[0])
  assert.equal(games.pickKKSong(['K.K. Bossa'], () => 0.5), 'K.K. Bossa')
})

test('humanGameName is used for the tray tooltip', () => {
  assert.equal(games.humanGameName('new-leaf-rainy'), 'New Leaf Rainy')
  assert.equal(games.humanGameName('kk-slider-desktop'), 'Kk Slider')
})
