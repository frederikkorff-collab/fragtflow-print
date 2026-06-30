import { Tray, Menu, nativeImage, app } from 'electron'
import path from 'path'
import { getSettings, setSettings } from './store'
import { getStatus, onStatusChange, startPoller, stopPoller } from './poller'

let tray: Tray | null = null
let openSettings: () => void = () => undefined

function iconPath(): string {
  // A 16x16 template/tray icon shipped in assets/.
  const name = process.platform === 'win32' ? 'tray.ico' : 'trayTemplate.png'
  return path.join(__dirname, '..', 'assets', name)
}

function buildMenu() {
  const s = getSettings()
  const st = getStatus()
  const online = st.lastPollAt && Date.now() - st.lastPollAt < 30_000

  const statusLine = !s.token
    ? 'Ikke konfigureret'
    : s.paused
      ? 'Sat på pause'
      : online
        ? 'Online'
        : 'Forbinder…'

  return Menu.buildFromTemplate([
    { label: `FragtFlow Print — ${statusLine}`, enabled: false },
    {
      label: s.stationName ? `Station: ${s.stationName}` : 'Ingen station',
      enabled: false,
    },
    { label: `Udskrevet: ${st.printedCount} · Fejlet: ${st.failedCount}`, enabled: false },
    { type: 'separator' },
    { label: 'Åbn indstillinger…', click: () => openSettings() },
    {
      label: s.paused ? 'Genoptag udskrivning' : 'Sæt udskrivning på pause',
      click: () => {
        const next = !getSettings().paused
        setSettings({ paused: next })
        if (next) stopPoller()
        else startPoller()
        refreshTray()
      },
    },
    { type: 'separator' },
    { label: 'Afslut', click: () => { app.quit() } },
  ])
}

export function refreshTray() {
  if (tray) tray.setContextMenu(buildMenu())
}

export function createTray(onOpenSettings: () => void) {
  openSettings = onOpenSettings
  let img = nativeImage.createFromPath(iconPath())
  if (img.isEmpty()) {
    // Fall back to a 1px transparent image so the tray still appears if the
    // icon asset is missing during development.
    img = nativeImage.createEmpty()
  }
  tray = new Tray(img)
  tray.setToolTip('FragtFlow Print')
  tray.setContextMenu(buildMenu())
  tray.on('click', () => onOpenSettings())

  onStatusChange(() => refreshTray())
}
