// Main renderer entry point
import { ScaleTool, ScaleLine, calculateLineLength, calculateScale } from './components/ScaleTool'

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
let currentImage: ImageInfo | null = null

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
    }
}
window.scaleLine = null
window.scaleValue = null

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
            </div>
        </div>
        <div class="viewer-toolbar">
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
    `

    // Handle back button
    const backBtn = document.getElementById('back-to-grid-btn')
    backBtn?.addEventListener('click', () => closeImageViewer())

    // Setup canvas after image loads
    const viewerImage = document.getElementById('viewer-image') as HTMLImageElement
    const scaleCanvas = document.getElementById('scale-canvas') as HTMLCanvasElement

    if (viewerImage && scaleCanvas) {
        viewerImage.onload = () => {
            initializeScaleTool(scaleCanvas, viewerImage)
        }

        // If image is already loaded (cached)
        if (viewerImage.complete) {
            initializeScaleTool(scaleCanvas, viewerImage)
        }
    }
}

// Initialize the scale tool for line drawing
function initializeScaleTool(canvas: HTMLCanvasElement, image: HTMLImageElement): void {
    // Size canvas to match image
    const container = document.getElementById('canvas-container')
    if (!container) return

    // Get the actual displayed size of the image
    const rect = image.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

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
    currentImage = null

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
