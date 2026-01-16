import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Add IPC methods here as needed
  getVersion: () => process.versions.electron
})
