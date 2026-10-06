const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')

const tone = fs.readFileSync(path.join(__dirname, 'fixtures', 'tone.ogg'))
let server
let requests = []

const startServer = () => new Promise(resolve => {
  server = http.createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`)
    if (req.url.includes('missing')) {
      res.writeHead(404)
      return res.end()
    }
    res.writeHead(200, {
      'content-type': 'audio/ogg',
      'content-length': tone.length,
      'last-modified': 'Tue, 01 Jan 2030 00:00:00 GMT'
    })
    if (req.method === 'HEAD') return res.end()
    res.end(tone)
  })
  server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`))
})

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nook-library-'))
let Library
let LibraryError
let storage

test.before(async () => {
  process.env.NOOK_CDN_URL = await startServer()
  storage = require('electron-json-storage')
  storage.setDataPath(path.join(dataDir, 'settings'))
  ;({ Library, LibraryError } = require('../app/hidden/lib/library'))
})

test.after(() => {
  server.close()
  fs.rmSync(dataDir, { recursive: true, force: true })
})

const makeLibrary = (overrides = {}) => {
  const events = { downloaded: [], removed: [] }
  const library = new Library({
    dir: dataDir,
    preferNoDownload: () => false,
    onDownloaded: kind => events.downloaded.push(kind),
    onRemoved: kind => events.removed.push(kind),
    pauseMs: 0,
    ...overrides
  })
  return { library, events }
}

test('resolve downloads a track once and then serves the cached copy', async () => {
  const { library, events } = makeLibrary()
  requests = []
  const location = await library.resolve('new-leaf', '3pm')
  assert.equal(location, path.join(dataDir, 'sound', 'new-leaf-3pm.ogg'))
  assert.ok(fs.readFileSync(location).equals(tone))
  assert.deepEqual(events.downloaded, ['hourly'])
  assert.deepEqual(requests, ['HEAD /new-leaf/3pm.ogg', 'GET /new-leaf/3pm.ogg'])

  requests = []
  await library.resolve('new-leaf', '3pm')
  assert.deepEqual(requests, ['HEAD /new-leaf/3pm.ogg'], 'only re-checks the timestamp')
  assert.deepEqual(events.downloaded, ['hourly'])
})

test('resolve returns the remote url when the user prefers streaming', async () => {
  const { library } = makeLibrary({ preferNoDownload: () => true })
  const location = await library.resolve('new-horizons', '1am')
  assert.equal(location, `${process.env.NOOK_CDN_URL}/new-horizons/1am.ogg`)
})

test('resolve reports a missing track with the right message key', async () => {
  const { library } = makeLibrary()
  await assert.rejects(library.resolve('new-leaf', 'missing'), err => err instanceof LibraryError && err.key === 'failedToLoadSound')
  await assert.rejects(library.resolve('rain', 'missing'), err => err.key === 'failedToLoadRainSound')
})

test('removeCorrupt deletes the file and its metadata', async () => {
  const { library, events } = makeLibrary()
  const location = await library.resolve('kk-slider-desktop', 'K.K. Bossa')
  assert.ok(fs.existsSync(location))
  await library.removeCorrupt('kk-slider-desktop', 'K.K. Bossa')
  assert.equal(fs.existsSync(location), false)
  assert.equal(storage.getSync('meta-kk-slider-desktop-K.K. Bossa').lastModified, undefined)
  assert.deepEqual(events.removed, ['kk'])
})

test('downloadAll reports progress and gives up after three failures', async () => {
  const { library } = makeLibrary()
  const progress = []
  const ok = await library.downloadAll([
    { game: 'wild-world', track: '1am' },
    { game: 'wild-world', track: '2am' }
  ], p => progress.push(Math.round(p)))
  assert.equal(ok, true)
  assert.deepEqual(progress, [50, 100])

  const failed = await library.downloadAll(
    ['a', 'b', 'c', 'd'].map(track => ({ game: 'missing', track })),
    () => {}
  )
  assert.equal(failed, false)
})

test('counts split cached files by kind', async () => {
  const keys = await new Promise(resolve => storage.keys((err, k) => resolve(err ? [] : k)))
  const counts = Library.counts(keys)
  assert.ok(counts.hourly >= 3)
  assert.equal(counts.kk, 0)
  assert.deepEqual(Library.counts(['meta-rain-rain', 'meta-kk-slider-desktop-Farewell', 'other']), { hourly: 0, kk: 1 })
})
