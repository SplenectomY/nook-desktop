/**
 * The offline music library: mirrors tracks from the CDN into the user's data
 * folder and hands back whichever location should be played.
 */
const fs = require('fs')
const path = require('path')
const superagent = require('superagent')
const storage = require('electron-json-storage')
const games = require('../../shared/games')

const BASE_URL = process.env.NOOK_CDN_URL || 'https://d17orwheorv96d.cloudfront.net'
const RAIN_GAME = 'rain'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

class LibraryError extends Error {
  constructor (key) {
    super(key)
    this.key = key
  }
}

const metaKey = cacheName => `meta-${cacheName}`

class Library {
  /**
   * @param {object} opts
   * @param {string} opts.dir          folder that holds the downloaded .ogg files
   * @param {Function} opts.preferNoDownload returns true when the user wants streaming only
   * @param {Function} opts.onDownloaded (kind: 'kk' | 'hourly') after each new file
   * @param {Function} opts.onRemoved   (kind) after a corrupt file is deleted
   * @param {number} [opts.pauseMs]     delay between bulk downloads
   */
  constructor ({ dir, preferNoDownload, onDownloaded = () => {}, onRemoved = () => {}, pauseMs = 1000 }) {
    this.dir = dir
    this.preferNoDownload = preferNoDownload
    this.onDownloaded = onDownloaded
    this.onRemoved = onRemoved
    this.pauseMs = pauseMs
  }

  static remoteUrl (game, track) {
    return `${BASE_URL}/${game}/${track}.ogg`
  }

  static cacheName (game, track) {
    return `${game}-${track}`
  }

  static kind (cacheName) {
    if (cacheName.startsWith(RAIN_GAME + '-')) return 'rain'
    return cacheName.startsWith(games.KK_GAME) ? 'kk' : 'hourly'
  }

  localPath (game, track) {
    return path.join(this.dir, 'sound', `${Library.cacheName(game, track)}.ogg`)
  }

  /** Counts cached files per kind from the stored metadata. */
  static counts (keys) {
    const cached = keys.filter(k => k.startsWith('meta-')).map(k => k.slice(5))
    return {
      hourly: cached.filter(n => Library.kind(n) === 'hourly').length,
      kk: cached.filter(n => Library.kind(n) === 'kk').length
    }
  }

  /**
   * Returns the location to play for a track: the remote URL when streaming,
   * otherwise the cached file (downloading or refreshing it first).
   */
  async resolve (game, track) {
    const remote = Library.remoteUrl(game, track)
    if (this.preferNoDownload()) return remote
    const cacheName = Library.cacheName(game, track)
    const cached = storage.getSync(metaKey(cacheName)).lastModified
    const result = await this.ensureCached(game, track, cached)
    if (result === 'failed' && !cached) {
      throw new LibraryError(Library.kind(cacheName) === 'rain' ? 'failedToLoadRainSound' : 'failedToLoadSound')
    }
    return this.localPath(game, track)
  }

  /**
   * Downloads a track when the CDN has a newer copy than the cache.
   * @returns {'cached' | 'downloaded' | 'failed'}
   */
  async ensureCached (game, track, cachedLastModified) {
    const remote = Library.remoteUrl(game, track)
    const cacheName = Library.cacheName(game, track)
    try {
      const head = await superagent.head(remote)
      const lastModified = head.headers && head.headers['last-modified']
      if (!lastModified) return 'failed'
      if (cachedLastModified && +new Date(cachedLastModified) === +new Date(lastModified)) return 'cached'

      const res = await superagent.get(remote).responseType('blob')
      await fs.promises.mkdir(path.join(this.dir, 'sound'), { recursive: true })
      await fs.promises.writeFile(this.localPath(game, track), res.body)
      await new Promise(resolve => storage.set(metaKey(cacheName), { lastModified }, resolve))
      this.onDownloaded(Library.kind(cacheName))
      return 'downloaded'
    } catch (err) {
      console.error(`could not fetch ${remote}`, err && err.message)
      return 'failed'
    }
  }

  /** Deletes a cached file that no longer decodes so it is fetched again. */
  async removeCorrupt (game, track) {
    const cacheName = Library.cacheName(game, track)
    await fs.promises.unlink(this.localPath(game, track)).catch(() => {})
    await new Promise(resolve => storage.remove(metaKey(cacheName), resolve))
    this.onRemoved(Library.kind(cacheName))
  }

  /**
   * Downloads a list of { game, track } entries one after another, pausing
   * between real downloads so the CDN is not hammered. Gives up after three
   * failures.
   * @returns {boolean} whether everything was fetched
   */
  async downloadAll (entries, onProgress) {
    let errors = 0
    for (const [index, { game, track }] of entries.entries()) {
      const cached = storage.getSync(metaKey(Library.cacheName(game, track))).lastModified
      if (!cached) {
        const result = await this.ensureCached(game, track, cached)
        if (result === 'failed') errors++
        await sleep(this.pauseMs)
      }
      onProgress(((index + 1) / entries.length) * 100)
      if (errors >= 3) return false
    }
    return true
  }

  static hourlyEntries () {
    return games.GAME_IDS.flatMap(game => games.tracksForGame(game).map(track => ({ game, track })))
  }

  static kkEntries () {
    return games.kkSongs.map(track => ({ game: games.KK_GAME, track }))
  }
}

module.exports = { Library, LibraryError, RAIN_GAME }
