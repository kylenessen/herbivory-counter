import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, readdirSync } from 'fs'
import { Database, initDatabase, ScaleData, Vertex } from './database'

let mainWindow: BrowserWindow | null = null
let currentDatabase: Database | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.setTitle('Herbivory Counter')

  // In development, load from vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC Handler: Open folder dialog and initialize database
ipcMain.handle('dialog:openFolder', async () => {
  if (!mainWindow) return { success: false, error: 'No window available' }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Image Folder'
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true }
  }

  const folderPath = result.filePaths[0]

  try {
    // Close existing database if open
    if (currentDatabase) {
      currentDatabase.close()
    }

    // Initialize database in the selected folder
    currentDatabase = initDatabase(folderPath)

    // Scan for image files and add them to database
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.heic', '.heif']
    const files = readdirSync(folderPath)
    const imageFiles = files.filter(file => {
      const ext = file.toLowerCase().slice(file.lastIndexOf('.'))
      return imageExtensions.includes(ext)
    })

    // Add images to database if not already present
    for (const imageFile of imageFiles) {
      const imagePath = join(folderPath, imageFile)
      const existing = currentDatabase.getImageByPath(imagePath)
      if (!existing) {
        currentDatabase.insertImage(imagePath)
      }
    }

    // Get all images from database
    const images = currentDatabase.getAllImages()

    return {
      success: true,
      folderPath,
      images: images.map(img => ({
        id: img.id,
        filepath: img.filepath,
        filename: img.filepath.split('/').pop() || img.filepath,
        sheetId: img.sheet_id,
        completed: img.completed
      })),
      databasePath: join(folderPath, 'herbivory.db')
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// IPC Handler: Check if database exists in folder
ipcMain.handle('database:exists', async (_, folderPath: string) => {
  const dbPath = join(folderPath, 'herbivory.db')
  return existsSync(dbPath)
})

// IPC Handler: Get database tables (for verification)
ipcMain.handle('database:getTables', async () => {
  if (!currentDatabase) {
    return { success: false, error: 'No database open' }
  }
  return {
    success: true,
    tables: currentDatabase.getTables()
  }
})

// IPC Handler: Save scale calibration for an image
ipcMain.handle('image:saveScale', async (_, imageId: number, scale: ScaleData) => {
  if (!currentDatabase) {
    return { success: false, error: 'No database open' }
  }
  try {
    currentDatabase.updateImageScale(imageId, scale)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// IPC Handler: Get scale calibration for an image
ipcMain.handle('image:getScale', async (_, imageId: number) => {
  if (!currentDatabase) {
    return { success: false, error: 'No database open' }
  }
  try {
    const scale = currentDatabase.getImageScale(imageId)
    return { success: true, scale }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// IPC Handler: Clear scale calibration for an image
ipcMain.handle('image:clearScale', async (_, imageId: number) => {
  if (!currentDatabase) {
    return { success: false, error: 'No database open' }
  }
  try {
    currentDatabase.clearImageScale(imageId)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

ipcMain.handle('polygon:getForImage', async (_, imageId: number) => {
  if (!currentDatabase) {
    return { success: false, error: 'No database open' }
  }
  try {
    const polygons = currentDatabase.getPolygonsForImage(imageId).map((p) => ({
      id: p.id,
      imageId: p.image_id,
      leafId: p.leaf_id,
      vertices: JSON.parse(p.vertices) as Vertex[]
    }))
    return { success: true, polygons }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

ipcMain.handle('polygon:upsert', async (_, imageId: number, leafId: string, vertices: Vertex[]) => {
  if (!currentDatabase) {
    return { success: false, error: 'No database open' }
  }
  try {
    const existing = currentDatabase.getPolygonsForImage(imageId).find((p) => p.leaf_id === leafId)
    if (existing) {
      currentDatabase.updatePolygonVertices(existing.id, vertices)
      return { success: true, polygonId: existing.id }
    }
    const polygonId = currentDatabase.insertPolygon(imageId, leafId, vertices)
    return { success: true, polygonId }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

ipcMain.handle('polygon:delete', async (_, polygonId: number) => {
  if (!currentDatabase) {
    return { success: false, error: 'No database open' }
  }
  try {
    currentDatabase.deletePolygon(polygonId)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up database on app quit
app.on('before-quit', () => {
  if (currentDatabase) {
    currentDatabase.close()
    currentDatabase = null
  }
})
