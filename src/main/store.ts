import Store from 'electron-store'
import { DEFAULT_API_URL, DEFAULT_POLL_INTERVAL } from './config'

export type Settings = {
  /** Print-queue function URL. */
  apiUrl: string
  /** Per-station print client token (from FragtFlow → Indstillinger → Printere). */
  token: string
  /** OS printer name to send jobs to. Empty = use the printer the server sends. */
  printer: string
  /** Human-readable station name (informational). */
  stationName: string
  /** Poll interval in milliseconds. */
  pollInterval: number
  /** Whether polling is currently paused by the user. */
  paused: boolean
  /** Launch automatically on login. */
  autoLaunch: boolean
}

const defaults: Settings = {
  apiUrl: DEFAULT_API_URL,
  token: '',
  printer: '',
  stationName: '',
  pollInterval: DEFAULT_POLL_INTERVAL,
  paused: false,
  autoLaunch: true,
}

export const store = new Store<Settings>({
  name: 'fragtflow-print-config',
  defaults,
})

export function getSettings(): Settings {
  return {
    apiUrl: store.get('apiUrl'),
    token: store.get('token'),
    printer: store.get('printer'),
    stationName: store.get('stationName'),
    pollInterval: store.get('pollInterval'),
    paused: store.get('paused'),
    autoLaunch: store.get('autoLaunch'),
  }
}

export function setSettings(patch: Partial<Settings>): Settings {
  for (const [k, v] of Object.entries(patch)) {
    store.set(k as keyof Settings, v as never)
  }
  return getSettings()
}
