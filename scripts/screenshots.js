/**
 * Drives the app through its pages and saves screenshots, plus a burst of
 * frames of the K.K. animation. Run with `npm run screenshots`; it uses the
 * fixtures from scripts/screenshots.env so no network or audio CDN is needed.
 */
const fs = require('fs')
const path = require('path')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

module.exports = ({ app, mainWindow, playerWindow }) => {
  const outDir = path.resolve(process.env.NOOK_SCREENSHOT_DIR || 'screenshots')
  fs.mkdirSync(outDir, { recursive: true })
  fs.rmSync(path.join(outDir, 'frames'), { recursive: true, force: true })
  fs.mkdirSync(path.join(outDir, 'frames'))

  const problems = []
  for (const [name, win] of [['window', mainWindow], ['player', playerWindow]]) {
    win.webContents.on('console-message', (event, level, message) => {
      const line = `[${name}] ${message}`
      console.log(line)
      if (level >= 2) problems.push(line)
    })
  }

  const js = code => mainWindow.webContents.executeJavaScript(code)
  const click = selector => js(`document.querySelector(${JSON.stringify(selector)}).click()`)
  const shot = async name => {
    const image = await mainWindow.webContents.capturePage()
    fs.writeFileSync(path.join(outDir, `${name}.png`), image.toPNG())
    console.log(`saved ${name}.png`)
  }
  const waitFor = async (code, timeout = 10000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (await js(code)) return true
      await sleep(100)
    }
    throw new Error(`timed out waiting for ${code}`)
  }

  const run = async () => {
    await waitFor('document.querySelector(".container.visible") !== null')
    await waitFor('!document.querySelector("#nowPlaying").classList.contains("hidden")')

    // A fresh profile has realtime weather off: switch it on with a (fixture) key.
    await click('#settings')
    await js(`
      const input = document.querySelector('#weatherApiCode')
      input.value = 'fixture-key'
      input.dispatchEvent(new Event('change', { bubbles: true }))
    `)
    await click('#useRealtimeWeather')
    await sleep(400)
    await shot('settings')

    await click('#home')
    await waitFor('document.querySelector("#weatherStrip").classList.contains("on")')
    await waitFor('document.querySelector("#nowPlaying .np-track").textContent === "9pm"')
    await sleep(500)
    await shot('home')

    await click('#weatherStrip')
    await sleep(300)
    await shot('weather-fahrenheit')
    await click('.unit-toggle [data-unit="c"]')
    await sleep(200)
    await shot('weather-celsius')
    await js('document.querySelector(".main").scrollTop = 10000')
    await sleep(200)
    await shot('weather-forecast')

    await click('#home')
    await click('#settings')
    await sleep(300)

    // Saturday night: K.K. takes the stage.
    await click('#kkSaturday')
    await click('#home')
    await waitFor('!document.querySelector("#kkScene").classList.contains("hidden")')
    await sleep(600)
    await shot('kk-night')
    for (let i = 0; i < 40; i++) {
      const image = await mainWindow.webContents.capturePage()
      fs.writeFileSync(path.join(outDir, 'frames', `kk-${String(i).padStart(3, '0')}.png`), image.toPNG())
      await sleep(80)
    }
    console.log('saved 40 animation frames')

    await click('#settings')
    await sleep(400)
    await click('#useRealtimeWeather')
    await sleep(200)
    await click('#home')
    await click('#weatherStrip')
    await sleep(300)
    await shot('weather-off')

    fs.writeFileSync(path.join(outDir, 'console.log'), problems.join('\n'))
    console.log(problems.length ? `${problems.length} console warnings/errors, see console.log` : 'no console errors')
    app.exit(problems.length ? 1 : 0)
  }

  mainWindow.webContents.once('did-finish-load', () => {
    run().catch(err => {
      console.error(err)
      app.exit(2)
    })
  })
}
