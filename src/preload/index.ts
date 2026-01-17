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

export interface ScaleData {
  pxPerCm: number
  lineStartX: number
  lineStartY: number
  lineEndX: number
  lineEndY: number
  cmValue: number
}

export interface SaveScaleResult {
  success: boolean
  error?: string
}

export interface GetScaleResult {
  success: boolean
  error?: string
  scale?: ScaleData | null
}

export interface Vertex {
  x: number
  y: number
}

export interface PolygonInfo {
  id: number
  imageId: number
  leafId: string
  vertices: Vertex[]
}

export interface GetPolygonsResult {
  success: boolean
  error?: string
  polygons?: PolygonInfo[]
}

export interface UpsertPolygonResult {
  success: boolean
  error?: string
  polygonId?: number
}

export interface DeletePolygonResult {
  success: boolean
  error?: string
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
    ipcRenderer.invoke('database:getTables'),

  // Save scale calibration data to the database
  saveImageScale: (imageId: number, scale: ScaleData): Promise<SaveScaleResult> =>
    ipcRenderer.invoke('image:saveScale', imageId, scale),

  // Load scale calibration data for an image
  getImageScale: (imageId: number): Promise<GetScaleResult> =>
    ipcRenderer.invoke('image:getScale', imageId),

  // Clear scale calibration data for an image
  clearImageScale: (imageId: number): Promise<SaveScaleResult> =>
    ipcRenderer.invoke('image:clearScale', imageId),

  // Get polygons for an image
  getPolygonsForImage: (imageId: number): Promise<GetPolygonsResult> =>
    ipcRenderer.invoke('polygon:getForImage', imageId),

  // Insert or update a polygon
  upsertPolygon: (imageId: number, leafId: string, vertices: Vertex[]): Promise<UpsertPolygonResult> =>
    ipcRenderer.invoke('polygon:upsert', imageId, leafId, vertices),

  // Delete a polygon (also deletes associated cells via cascade)
  deletePolygon: (polygonId: number): Promise<DeletePolygonResult> =>
    ipcRenderer.invoke('polygon:delete', polygonId)
})

// Type declaration for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      getVersion: () => string
      openFolder: () => Promise<OpenFolderResult>
      databaseExists: (folderPath: string) => Promise<boolean>
      getDatabaseTables: () => Promise<TablesResult>
      saveImageScale: (imageId: number, scale: ScaleData) => Promise<SaveScaleResult>
      getImageScale: (imageId: number) => Promise<GetScaleResult>
      clearImageScale: (imageId: number) => Promise<SaveScaleResult>
      getPolygonsForImage: (imageId: number) => Promise<GetPolygonsResult>
      upsertPolygon: (imageId: number, leafId: string, vertices: Vertex[]) => Promise<UpsertPolygonResult>
      deletePolygon: (polygonId: number) => Promise<DeletePolygonResult>
    }
  }
}
