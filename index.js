/**
 * Electron main process: owns the visible window, the hidden player window,
 * the tray icon and the handful of privileged actions the windows ask for.
 */
const { app, BrowserWindow, Tray, nativeImage, Menu, ipcMain, shell, powerMonitor } = require('electron')
const path = require('path')
const fs = require('fs')
const storage = require('electron-json-storage')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log')

// Development: keep a throwaway profile apart from the real one.
if (process.env.NOOK_USER_DATA) app.setPath('userData', path.resolve(process.env.NOOK_USER_DATA))

const userSettingsPath = path.join(app.getPath('userData'), 'userSettings')
storage.setDataPath(userSettingsPath)

const iconDir = app.isPackaged
  ? path.join(process.resourcesPath, 'build', 'icons')
  : path.join(__dirname, 'build', 'icons')

/** The only pages the renderer may ask the OS browser to open. */
const EXTERNAL_LINKS = {
  patreon: 'https://www.patreon.com/mattu',
  github: 'https://nook.camp',
  weatherapi: 'https://www.weatherapi.com/signup.aspx'
}

const windowOptions = {
  webPreferences: {
    backgroundThrottling: false,
    nodeIntegration: true,
    contextIsolation: false
  }
}

let mainWindow = null
let playerWindow = null
let tray = null
let playingLabel = 'Nook - playing nothing!'

const destroyTray = () => {
  if (tray && !tray.isDestroyed()) tray.destroy()
  tray = null
}

const quit = () => {
  destroyTray()
  app.exit()
}

const showFromTray = () => {
  destroyTray()
  mainWindow.restore()
  mainWindow.show()
  mainWindow.setSkipTaskbar(false)
  if (app.dock) app.dock.show()
}

const hideToTray = () => {
  destroyTray()
  if (app.dock) app.dock.hide()
  mainWindow.setSkipTaskbar(true)
  mainWindow.hide()

  const image = process.platform === 'darwin' ? 'nookTemplate.png' : 'nookTray.png'
  tray = new Tray(nativeImage.createFromPath(path.join(iconDir, image)))
  tray.setToolTip(playingLabel)
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Exit', click: quit },
    { label: 'Show', click: showFromTray }
  ]))
  tray.on('click', showFromTray)
}

const sendToPlayer = (...args) => playerWindow.webContents.send('toPlayer', args)
const sendToWindow = (...args) => mainWindow.webContents.send('toWindow', args)

const clearSettings = async () => {
  sendToWindow('bar', 1)
  await new Promise(resolve => storage.clear(resolve))
  sendToWindow('bar', 50)
  await fs.promises.rm(path.join(userSettingsPath, 'sound'), { recursive: true, force: true })
  sendToWindow('bar', 100)
  app.relaunch()
  app.exit()
}

const createWindows = () => {
  mainWindow = new BrowserWindow({
    ...windowOptions,
    width: 400,
    height: 500,
    autoHideMenuBar: true,
    transparent: true,
    frame: false,
    resizable: false,
    icon: path.join(iconDir, 'nook.png')
  })
  mainWindow.loadFile('./app/main/index.html')
  mainWindow.on('close', quit)

  playerWindow = new BrowserWindow({
    ...windowOptions,
    width: 500,
    height: 500,
    show: false,
    skipTaskbar: true,
    excludedFromShownWindowsMenu: true,
    focusable: false
  })
  playerWindow.loadFile('./app/hidden/index.html')

  ipcMain.on('min', hideToTray)
  ipcMain.on('close', quit)
  ipcMain.on('clearSettings', () => clearSettings().catch(err => log.error(err)))
  ipcMain.on('openExternal', (event, key) => {
    if (EXTERNAL_LINKS[key]) shell.openExternal(EXTERNAL_LINKS[key])
  })
  ipcMain.on('openOnStartup', (event, [openAtLogin]) => app.setLoginItemSettings({ openAtLogin }))
  ipcMain.on('playerLoaded', () => sendToPlayer('userSettingsPath', userSettingsPath, app.getVersion()))
  ipcMain.on('toPlayer', (event, args) => sendToPlayer(...args))
  ipcMain.on('toWindow', (event, args) => sendToWindow(...args))
  ipcMain.on('playing', (event, [game, track]) => {
    playingLabel = game ? `Nook - playing ${game} (${track})!` : 'Nook - playing nothing!'
    if (tray && !tray.isDestroyed()) tray.setToolTip(playingLabel)
  })

  powerMonitor.on('suspend', () => sendToPlayer('pauseIfPlaying'))

  // Development hook used by `npm run screenshots` (see scripts/).
  if (process.env.NOOK_DEV_DRIVER) {
    require(path.resolve(process.env.NOOK_DEV_DRIVER))({ app, mainWindow, playerWindow })
  }
}

app.disableHardwareAcceleration()
if (process.platform === 'win32') app.setAppUserModelId(app.name)

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (!mainWindow.isVisible()) showFromTray()
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.whenReady().then(createWindows)
}

autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
autoUpdater.checkForUpdatesAndNotify().catch(err => log.warn('update check failed', err && err.message))
