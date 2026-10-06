/**
 * Small clock abstraction so the hour logic can be tested and so the app can
 * be driven at a fake time while developing (NOOK_FAKE_TIME=2026-10-10T21:30).
 * The fake time keeps advancing from the moment the process started.
 */
const fakeStart = process.env.NOOK_FAKE_TIME ? new Date(process.env.NOOK_FAKE_TIME) : null
const realStart = Date.now()

const now = () => {
  if (!fakeStart || Number.isNaN(fakeStart.getTime())) return new Date()
  return new Date(fakeStart.getTime() + (Date.now() - realStart))
}

module.exports = { now }
