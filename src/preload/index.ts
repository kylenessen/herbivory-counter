import { contextBridge, ipcRenderer } from 'electron'

// Type definitions for the exposed API
export interface ImageInfo {
  id: number
  filepath: string
  filename: string
  sheetId: string | null
  completed: boolean
}

export interface OpenFolderResult {
  success: boolean
  canceled?: boolean
  error?: string
  folderPath?: string
  images?: ImageInfo[]
  databasePath?: string
}

export interface TablesResult {
  success: boolean
  error?: string
  tables?: string[]
}

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Get Electron version
  getVersion: () => process.versions.electron,

  // Open folder dialog and initialize database
  openFolder: (): Promise<OpenFolderResult> => ipcRenderer.invoke('dialog:openFolder'),

  // Check if database exists in folder
  databaseExists: (folderPath: string): Promise<boolean> =>
    ipcRenderer.invoke('database:exists', folderPath),

  // Get database tables (for verification)
  getDatabaseTables: (): Promise<TablesResult> =>
    ipcRenderer.invoke('database:getTables')
})

// Type declaration for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      getVersion: () => string
      openFolder: () => Promise<OpenFolderResult>
      databaseExists: (folderPath: string) => Promise<boolean>
      getDatabaseTables: () => Promise<TablesResult>
    }
  }
}

