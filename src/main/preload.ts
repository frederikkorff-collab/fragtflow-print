import { contextBridge, ipcRenderer } from 'electron'
import type { Settings } from './store'
import type { PollerStatus } from './poller'

export type Bridge = {
  getSettings: () => Promise<Settings>
  saveSettings: (patch: Partial<Settings>) => Promise<Settings>
  listPrinters: () => Promise<Array<{ name: string; virtual: boolean }>>
  testConnection: () => Promise<{ ok: boolean; message: string }>
  getStatus: () => Promise<PollerStatus>
  onStatus: (cb: (s: PollerStatus) => void) => void
}

const bridge: Bridge = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  listPrinters: () => ipcRenderer.invoke('printers:list'),
  testConnection: () => ipcRenderer.invoke('connection:test'),
  getStatus: () => ipcRenderer.invoke('status:get'),
  onStatus: (cb) => {
    ipcRenderer.on('status:update', (_e, s) => cb(s))
  },
}

contextBridge.exposeInMainWorld('fragtflow', bridge)
