import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import log from 'electron-log'
import { autoUpdater } from 'electron-updater'
import { getSettings, setSettings, store } from './store'
import { listPrinters } from './printer'
import { testConnection } from './api'
import { startPoller, stopPoller, getStatus, onStatusChange } from './poller'
import { createTray, refreshTray } from './tray'

log.initialize?.()
log.info('FragtFlow Print starter')

let settingsWindow: BrowserWindow | null = null

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.show()
    settingsWindow.focus()
    return
  }
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 640,
    resizable: false,
    title: 'FragtFlow Print — Indstillinger',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'))
  settingsWindow.on('closed', () => { settingsWindow = null })
}

function applyAutoLaunch() {
  if (process.platform === 'linux') return
  const { autoLaunch } = getSettings()
  app.setLoginItemSettings({ openAtLogin: autoLaunch, openAsHidden: true })
}

// ---- IPC ----
function registerIpc() {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:save', (_e, patch) => {
    const next = setSettings(patch)
    applyAutoLaunch()
    // Restart polling so interval / pause / token changes take effect.
    stopPoller()
    if (!next.paused) startPoller()
    refreshTray()
    return next
  })
  ipcMain.handle('printers:list', () => listPrinters())
  ipcMain.handle('connection:test', () => testConnection())
  ipcMain.handle('status:get', () => getStatus())
}

// Single-instance — clicking the launcher again just opens settings.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => createSettingsWindow())

  app.whenReady().then(() => {
    registerIpc()
    applyAutoLaunch()
    createTray(createSettingsWindow)

    // Push live status into an open settings window.
    onStatusChange((s) => {
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('status:update', s)
      }
    })

    const { token, paused } = getSettings()
    if (token && !paused) startPoller()
    // First run with no token → show settings so the user can configure it.
    if (!token) createSettingsWindow()

    // Background update checks (no-op until a published release exists).
    try {
      autoUpdater.logger = log
      autoUpdater.checkForUpdatesAndNotify().catch(() => undefined)
      setInterval(() => autoUpdater.checkForUpdatesAndNotify().catch(() => undefined), 6 * 60 * 60 * 1000)
    } catch (err) {
      log.warn('Auto-update ikke tilgængelig', err)
    }
  })
}

// Keep running in the tray when all windows are closed.
app.on('window-all-closed', () => {
  // Intentionally do not quit — this is a background tray app.
})

app.on('before-quit', () => {
  stopPoller()
  store.set('paused', getSettings().paused)
})
