// Main renderer entry point
import { ScaleTool, ScaleLine, calculateLineLength, calculateScale } from './components/ScaleTool'
import { PolygonTool } from './components/PolygonTool'
import { Point } from '../shared/types'

console.log('Herbivory Counter initialized')

// Types
interface ImageInfo {
    id: number
    filepath: string
    filename: string
    sheetId: string | null
    completed: boolean
}

// State
let currentImages: ImageInfo[] = []
let currentFolderPath: string = ''
let currentScaleTool: ScaleTool | null = null
let currentPolygonTool: PolygonTool | null = null
let currentImage: ImageInfo | null = null
let currentToolMode: 'scale' | 'polygon' = 'scale'
let currentPolygonDbId: number | null = null

// Scale value interface for storing calculated scale
interface ScaleValue {
    pxPerCm: number
    cmValue: number
    lineLength: number
}

// Expose state for E2E testing
declare global {
    interface Window {
        scaleLine: ScaleLine | null
        scaleValue: ScaleValue | null
        polygonVertices: Point[]
        polygonClosed: boolean
    }
}
window.scaleLine = null
window.scaleValue = null
window.polygonVertices = []
window.polygonClosed = false

// Get DOM elements
const openFolderBtn = document.getElementById('open-folder-btn')
const welcomeSection = document.getElementById('welcome-section')
const folderStatus = document.getElementById('folder-status')
const folderPathSpan = document.getElementById('folder-path')
const databaseStatusSpan = document.getElementById('database-status')
const imageCountSpan = document.getElementById('image-count')
const tableListSpan = document.getElementById('table-list')
const imageGrid = document.getElementById('image-grid')
const imageViewer = document.getElementById('image-viewer')

// Render image thumbnails in the grid
function renderImageGrid(images: ImageInfo[]): void {
    if (!imageGrid) return

    imageGrid.innerHTML = ''

    for (const image of images) {
        const thumbnailDiv = document.createElement('div')
        thumbnailDiv.className = 'image-thumbnail'
        thumbnailDiv.setAttribute('data-image-id', image.id.toString())

        // Create image element
        const img = document.createElement('img')
        img.src = `file://${image.filepath}`
        img.alt = image.filename
        img.loading = 'lazy' // Lazy load for performance

        // Create label
        const label = document.createElement('div')
        label.className = 'thumbnail-label'
        label.textContent = image.filename

        // Create status indicator
        const statusIcon = document.createElement('div')
        statusIcon.className = 'thumbnail-status'
        if (image.completed) {
            statusIcon.classList.add('completed')
            statusIcon.innerHTML = '✓'
        }

        thumbnailDiv.appendChild(img)
        thumbnailDiv.appendChild(label)
        thumbnailDiv.appendChild(statusIcon)

        // Click handler to open full image view
        thumbnailDiv.addEventListener('click', () => openImageViewer(image))

        imageGrid.appendChild(thumbnailDiv)
    }
}

// Open full image viewer
function openImageViewer(image: ImageInfo): void {
    if (!imageViewer || !imageGrid || !folderStatus) return

    // Store current image
    currentImage = image

    // Hide grid and status, show viewer
    imageGrid.style.display = 'none'
    folderStatus.style.display = 'none'
    imageViewer.style.display = 'flex'

    // Update viewer content with canvas overlay for scale drawing
    imageViewer.innerHTML = `
        <div class="viewer-header">
            <button data-testid="back-to-grid" class="btn btn-secondary" id="back-to-grid-btn">
                ← Back to Grid
            </button>
            <span class="viewer-filename">${image.filename}</span>
        </div>
        <div class="viewer-content" id="viewer-content">
            <div class="canvas-container" id="canvas-container">
                <img class="viewer-image" id="viewer-image" src="file://${image.filepath}" alt="${image.filename}">
                <canvas data-testid="scale-canvas" id="scale-canvas" class="scale-canvas"></canvas>
                <canvas data-testid="polygon-canvas" id="polygon-canvas" class="polygon-canvas"></canvas>
            </div>
        </div>
        <div class="viewer-toolbar">
            <div class="tool-mode-toggle">
                <button data-testid="scale-mode-btn" class="btn btn-secondary tool-mode-btn active" id="scale-mode-btn">
                    Scale
                </button>
                <button data-testid="polygon-mode-btn" class="btn btn-secondary tool-mode-btn" id="polygon-mode-btn">
                    Polygon
                </button>
            </div>
            <div class="scale-section">
                <p data-testid="scale-instruction" class="scale-instruction" id="scale-instruction">
                    Draw a line along your scale ruler (click and drag)
                </p>
                <p data-testid="scale-line-length" class="scale-line-length" id="scale-line-length" style="display: none;">
                    Line length: <span id="line-length-value">0</span> px
                </p>
                <div data-testid="scale-confirm-section" class="scale-confirm-section" id="scale-confirm-section" style="display: none;">
                    <button class="btn btn-primary" id="confirm-scale-btn">Confirm Scale Line</button>
                    <button class="btn btn-secondary" id="clear-scale-btn">Clear</button>
                </div>
                <p data-testid="scale-display" class="scale-display" id="scale-display" style="display: none;">
                    1 cm = <span id="scale-px-value">0</span> px
                </p>
            </div>
            <div class="polygon-section" id="polygon-section" style="display: none;">
                <p data-testid="polygon-instruction" class="polygon-instruction">
                    Click on the image to add polygon vertices. Click near the first vertex to close the polygon.
                </p>
                <button class="btn btn-secondary" id="clear-polygon-btn">Clear Polygon</button>
                <button data-testid="polygon-delete-btn" class="btn btn-danger" id="delete-polygon-btn">Delete Polygon</button>
            </div>
        </div>
        <!-- Scale Input Dialog -->
        <div data-testid="scale-input-dialog" class="scale-input-dialog" id="scale-input-dialog" style="display: none;">
            <div class="dialog-content">
                <h3>Enter Scale Value</h3>
                <p>How many centimeters does your line represent?</p>
                <div class="dialog-input-group">
                    <input type="number" data-testid="scale-cm-input" id="scale-cm-input" value="10" min="0.1" step="0.1" />
                    <span>cm</span>
                </div>
                <div class="dialog-buttons">
                    <button data-testid="cancel-scale-btn" class="btn btn-secondary" id="cancel-scale-dialog-btn">Cancel</button>
                    <button data-testid="confirm-scale-value-btn" class="btn btn-primary" id="confirm-scale-value-btn">Confirm</button>
                </div>
            </div>
        </div>

        <!-- Polygon Delete Confirmation Dialog -->
        <div data-testid="polygon-delete-dialog" class="scale-input-dialog" id="polygon-delete-dialog" style="display: none;">
            <div class="dialog-content">
                <h3>Delete Polygon?</h3>
                <p>This will permanently delete the polygon and any associated classifications.</p>
                <div class="dialog-buttons">
                    <button data-testid="polygon-delete-cancel-btn" class="btn btn-secondary" id="polygon-delete-cancel-btn">Cancel</button>
                    <button data-testid="polygon-delete-confirm-btn" class="btn btn-danger" id="polygon-delete-confirm-btn">Delete</button>
                </div>
            </div>
        </div>
    `

    // Handle back button
    const backBtn = document.getElementById('back-to-grid-btn')
    backBtn?.addEventListener('click', () => closeImageViewer())

    // Setup canvas after image loads
    const viewerImage = document.getElementById('viewer-image') as HTMLImageElement
    const scaleCanvas = document.getElementById('scale-canvas') as HTMLCanvasElement
    const polygonCanvas = document.getElementById('polygon-canvas') as HTMLCanvasElement

    // Setup tool mode buttons
    const scaleModeBtn = document.getElementById('scale-mode-btn')
    const polygonModeBtn = document.getElementById('polygon-mode-btn')
    scaleModeBtn?.addEventListener('click', () => setToolMode('scale'))
    polygonModeBtn?.addEventListener('click', () => setToolMode('polygon'))

    const clearPolygonBtn = document.getElementById('clear-polygon-btn')
    clearPolygonBtn?.addEventListener('click', () => {
        void clearCurrentPolygon()
    })

    const deletePolygonBtn = document.getElementById('delete-polygon-btn')
    deletePolygonBtn?.addEventListener('click', () => {
        showPolygonDeleteDialog()
    })

    const polygonDeleteCancelBtn = document.getElementById('polygon-delete-cancel-btn')
    polygonDeleteCancelBtn?.addEventListener('click', () => {
        hidePolygonDeleteDialog()
    })

    const polygonDeleteConfirmBtn = document.getElementById('polygon-delete-confirm-btn')
    polygonDeleteConfirmBtn?.addEventListener('click', () => {
        void confirmDeleteCurrentPolygon()
    })

    if (viewerImage && scaleCanvas && polygonCanvas) {
        viewerImage.onload = () => {
            initializeScaleTool(scaleCanvas, viewerImage)
            initializePolygonTool(polygonCanvas, viewerImage)
            setToolMode('scale')
        }

        // If image is already loaded (cached)
        if (viewerImage.complete) {
            initializeScaleTool(scaleCanvas, viewerImage)
            initializePolygonTool(polygonCanvas, viewerImage)
            setToolMode('scale')
        }
    }
}

function sizeCanvasToImage(canvas: HTMLCanvasElement, image: HTMLImageElement): void {
    const rect = image.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
}

function setToolMode(mode: 'scale' | 'polygon'): void {
    currentToolMode = mode

    const scaleCanvas = document.getElementById('scale-canvas') as HTMLCanvasElement | null
    const polygonCanvas = document.getElementById('polygon-canvas') as HTMLCanvasElement | null
    const scaleSection = document.querySelector('.scale-section') as HTMLElement | null
    const polygonSection = document.getElementById('polygon-section')

    const scaleModeBtn = document.getElementById('scale-mode-btn')
    const polygonModeBtn = document.getElementById('polygon-mode-btn')

    if (scaleCanvas) scaleCanvas.style.pointerEvents = mode === 'scale' ? 'auto' : 'none'
    if (polygonCanvas) polygonCanvas.style.pointerEvents = mode === 'polygon' ? 'auto' : 'none'

    if (scaleSection) scaleSection.style.display = mode === 'scale' ? 'flex' : 'none'
    if (polygonSection) polygonSection.style.display = mode === 'polygon' ? 'flex' : 'none'

    scaleModeBtn?.classList.toggle('active', mode === 'scale')
    polygonModeBtn?.classList.toggle('active', mode === 'polygon')
}

// Initialize the scale tool for line drawing
function initializeScaleTool(canvas: HTMLCanvasElement, image: HTMLImageElement): void {
    // Size canvas to match image
    sizeCanvasToImage(canvas, image)

    // Clean up previous tool
    if (currentScaleTool) {
        currentScaleTool.destroy()
    }

    // Reset window state
    window.scaleLine = null
    window.scaleValue = null

    // Create new scale tool
    currentScaleTool = new ScaleTool(canvas)

    // Set up callback for line completion
    currentScaleTool.setOnLineComplete((line) => {
        window.scaleLine = line
        updateScaleUI(line)
    })

    // Start render loop
    requestAnimationFrame(renderScaleCanvas)

    // Restore any saved scale calibration for this image
    void restoreScaleForCurrentImage()

    // Setup clear button
    const clearBtn = document.getElementById('clear-scale-btn')
    clearBtn?.addEventListener('click', () => {
        if (currentScaleTool) {
            currentScaleTool.clearLine()
            window.scaleLine = null
            window.scaleValue = null
            const scaleDisplay = document.getElementById('scale-display')
            if (scaleDisplay) scaleDisplay.style.display = 'none'
            updateScaleUI(null)
        }
        if (currentImage) {
            void window.electronAPI.clearImageScale(currentImage.id)
        }
    })

    // Setup confirm scale line button (opens dialog)
    const confirmScaleBtn = document.getElementById('confirm-scale-btn')
    confirmScaleBtn?.addEventListener('click', () => {
        const dialog = document.getElementById('scale-input-dialog')
        const input = document.getElementById('scale-cm-input') as HTMLInputElement
        if (dialog && input) {
            input.value = '10' // Reset to default
            dialog.style.display = 'flex'
        }
    })

    // Setup cancel dialog button
    const cancelDialogBtn = document.getElementById('cancel-scale-dialog-btn')
    cancelDialogBtn?.addEventListener('click', () => {
        const dialog = document.getElementById('scale-input-dialog')
        if (dialog) {
            dialog.style.display = 'none'
        }
    })

    // Setup confirm scale value button (in dialog)
    const confirmScaleValueBtn = document.getElementById('confirm-scale-value-btn')
    confirmScaleValueBtn?.addEventListener('click', () => {
        const input = document.getElementById('scale-cm-input') as HTMLInputElement
        const dialog = document.getElementById('scale-input-dialog')
        const scaleDisplay = document.getElementById('scale-display')
        const scalePxValue = document.getElementById('scale-px-value')

        if (!input || !window.scaleLine) return

        const cmValue = parseFloat(input.value)
        if (isNaN(cmValue) || cmValue <= 0) {
            alert('Please enter a valid positive number')
            return
        }

        // Calculate scale
        const lineLength = calculateLineLength(window.scaleLine.start, window.scaleLine.end)
        const pxPerCm = calculateScale(lineLength, cmValue)

        // Store scale value
        window.scaleValue = {
            pxPerCm,
            cmValue,
            lineLength
        }

        // Persist scale to database
        if (currentImage) {
            void window.electronAPI.saveImageScale(currentImage.id, {
                pxPerCm,
                lineStartX: window.scaleLine.start.x,
                lineStartY: window.scaleLine.start.y,
                lineEndX: window.scaleLine.end.x,
                lineEndY: window.scaleLine.end.y,
                cmValue
            })
        }

        // Update UI
        if (dialog) dialog.style.display = 'none'
        if (scalePxValue) scalePxValue.textContent = pxPerCm.toFixed(1)
        if (scaleDisplay) scaleDisplay.style.display = 'block'
    })
}

function initializePolygonTool(canvas: HTMLCanvasElement, image: HTMLImageElement): void {
    sizeCanvasToImage(canvas, image)

    if (currentPolygonTool) {
        currentPolygonTool.destroy()
        currentPolygonTool = null
    }

    window.polygonVertices = []
    window.polygonClosed = false
    currentPolygonDbId = null

    currentPolygonTool = new PolygonTool(canvas)
    currentPolygonTool.setOnVerticesChanged((vertices) => {
        window.polygonVertices = vertices
        renderPolygonCanvasOnce()
    })
    currentPolygonTool.setOnClosedChanged((closed) => {
        window.polygonClosed = closed
        renderPolygonCanvasOnce()

        if (closed) {
            void persistCurrentPolygon()
        } else {
            currentPolygonDbId = null
        }
    })
    currentPolygonTool.setOnDeletePolygonRequested(() => {
        showPolygonDeleteDialog()
    })

    renderPolygonCanvasOnce()

    void restorePolygonForCurrentImage()
}

function renderPolygonCanvasOnce(): void {
    const canvas = document.getElementById('polygon-canvas') as HTMLCanvasElement | null
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    currentPolygonTool?.render()
}

function showPolygonDeleteDialog(): void {
    if (!currentPolygonTool) return
    if (currentPolygonTool.getVertices().length === 0) return

    const dialog = document.getElementById('polygon-delete-dialog')
    if (dialog) dialog.style.display = 'flex'
}

function hidePolygonDeleteDialog(): void {
    const dialog = document.getElementById('polygon-delete-dialog')
    if (dialog) dialog.style.display = 'none'
}

async function clearCurrentPolygon(): Promise<void> {
    if (currentImage) {
        const polygons = await window.electronAPI.getPolygonsForImage(currentImage.id)
        if (polygons.success && polygons.polygons) {
            for (const polygon of polygons.polygons) {
                await window.electronAPI.deletePolygon(polygon.id)
            }
        }
    }
    currentPolygonDbId = null
    currentPolygonTool?.clear()
    renderPolygonCanvasOnce()
}

async function confirmDeleteCurrentPolygon(): Promise<void> {
    hidePolygonDeleteDialog()
    await clearCurrentPolygon()
}

async function persistCurrentPolygon(): Promise<void> {
    if (!currentImage || !currentPolygonTool) return
    const vertices = currentPolygonTool.getVertices()
    if (!currentPolygonTool.isClosed() || vertices.length < 3) return

    const result = await window.electronAPI.upsertPolygon(currentImage.id, '01', vertices)
    if (result.success && result.polygonId) {
        currentPolygonDbId = result.polygonId
    }
}

async function restorePolygonForCurrentImage(): Promise<void> {
    if (!currentImage || !currentPolygonTool) return

    const result = await window.electronAPI.getPolygonsForImage(currentImage.id)
    if (!result.success || !result.polygons || result.polygons.length === 0) return

    const polygon = [...result.polygons].sort((a, b) => a.leafId.localeCompare(b.leafId))[0]
    currentPolygonTool.loadPolygon(polygon.vertices, true)
    currentPolygonDbId = polygon.id
}

// Restore scale from database for the current image (Feature 2.3)
async function restoreScaleForCurrentImage(): Promise<void> {
    if (!currentImage || !currentScaleTool) return

    const result = await window.electronAPI.getImageScale(currentImage.id)
    if (!result.success || !result.scale) return

    const scale = result.scale
    const line: ScaleLine = {
        start: { x: scale.lineStartX, y: scale.lineStartY },
        end: { x: scale.lineEndX, y: scale.lineEndY },
        isComplete: true,
        isDragging: false,
        dragTarget: null
    }

    currentScaleTool.setScaleLine(line)
    window.scaleLine = line

    const lineLength = calculateLineLength(line.start, line.end)
    window.scaleValue = {
        pxPerCm: scale.pxPerCm,
        cmValue: scale.cmValue,
        lineLength
    }

    updateScaleUI(line)

    const scaleDisplay = document.getElementById('scale-display')
    const scalePxValue = document.getElementById('scale-px-value')
    if (scalePxValue) scalePxValue.textContent = scale.pxPerCm.toFixed(1)
    if (scaleDisplay) scaleDisplay.style.display = 'block'
}

// Update scale UI based on line state
function updateScaleUI(line: ScaleLine | null): void {
    const instruction = document.getElementById('scale-instruction')
    const lengthDisplay = document.getElementById('scale-line-length')
    const lengthValue = document.getElementById('line-length-value')
    const confirmSection = document.getElementById('scale-confirm-section')

    if (line && line.isComplete) {
        // Line is drawn, show length and confirm UI
        if (instruction) instruction.style.display = 'none'
        if (lengthDisplay) lengthDisplay.style.display = 'block'
        if (confirmSection) confirmSection.style.display = 'flex'

        const length = calculateLineLength(line.start, line.end)
        if (lengthValue) lengthValue.textContent = Math.round(length).toString()
    } else {
        // No line, show instructions
        if (instruction) instruction.style.display = 'block'
        if (lengthDisplay) lengthDisplay.style.display = 'none'
        if (confirmSection) confirmSection.style.display = 'none'
    }
}

// Render loop for scale canvas
function renderScaleCanvas(): void {
    if (!currentScaleTool) return

    const canvas = document.getElementById('scale-canvas') as HTMLCanvasElement
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Render scale line
    currentScaleTool.render()

    // Update window state for E2E tests
    const line = currentScaleTool.getScaleLine()
    window.scaleLine = line

    // Update UI if line changed (e.g., during drag)
    if (line && line.isDragging) {
        const lengthValue = document.getElementById('line-length-value')
        if (lengthValue) {
            const length = calculateLineLength(line.start, line.end)
            lengthValue.textContent = Math.round(length).toString()
        }
    }

    // Continue render loop if viewer is open
    const imageViewer = document.getElementById('image-viewer')
    if (imageViewer && imageViewer.style.display !== 'none') {
        requestAnimationFrame(renderScaleCanvas)
    }
}

// Close image viewer and return to grid
function closeImageViewer(): void {
    if (!imageViewer || !imageGrid || !folderStatus) return

    // Clean up scale tool
    if (currentScaleTool) {
        currentScaleTool.destroy()
        currentScaleTool = null
    }
    window.scaleLine = null
    window.polygonVertices = []
    window.polygonClosed = false
    if (currentPolygonTool) {
        currentPolygonTool.destroy()
        currentPolygonTool = null
    }
    currentImage = null
    currentToolMode = 'scale'

    imageViewer.style.display = 'none'
    folderStatus.style.display = 'block'
    imageGrid.style.display = 'grid'
}

// Handle Open Folder button click
openFolderBtn?.addEventListener('click', async () => {
    try {
        const result = await window.electronAPI.openFolder()

        if (result.canceled) {
            console.log('Folder selection was canceled')
            return
        }

        if (!result.success) {
            console.error('Failed to open folder:', result.error)
            alert(`Error: ${result.error}`)
            return
        }

        // Store current state
        currentFolderPath = result.folderPath || ''
        currentImages = result.images || []

        // Update UI with folder info
        if (folderPathSpan) folderPathSpan.textContent = result.folderPath || ''
        if (databaseStatusSpan) databaseStatusSpan.textContent = result.databasePath || ''
        if (imageCountSpan) imageCountSpan.textContent = `${result.images?.length || 0} images found`

        // Get and display table list
        const tablesResult = await window.electronAPI.getDatabaseTables()
        if (tablesResult.success && tableListSpan) {
            tableListSpan.textContent = tablesResult.tables?.join(', ') || ''
        }

        // Show folder status, hide welcome
        if (welcomeSection) welcomeSection.style.display = 'none'
        if (folderStatus) folderStatus.style.display = 'block'

        // Render the image grid
        if (currentImages.length > 0 && imageGrid) {
            renderImageGrid(currentImages)
            imageGrid.style.display = 'grid'
        }

        console.log('Folder opened successfully:', result)
    } catch (error) {
        console.error('Error opening folder:', error)
        alert(`Error: ${error}`)
    }
})
