// Main renderer entry point
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

    // Hide grid and status, show viewer
    imageGrid.style.display = 'none'
    folderStatus.style.display = 'none'
    imageViewer.style.display = 'flex'

    // Update viewer content
    imageViewer.innerHTML = `
        <div class="viewer-header">
            <button data-testid="back-to-grid" class="btn btn-secondary" id="back-to-grid-btn">
                ← Back to Grid
            </button>
            <span class="viewer-filename">${image.filename}</span>
        </div>
        <div class="viewer-content">
            <img class="viewer-image" src="file://${image.filepath}" alt="${image.filename}">
        </div>
    `

    // Handle back button
    const backBtn = document.getElementById('back-to-grid-btn')
    backBtn?.addEventListener('click', () => closeImageViewer())
}

// Close image viewer and return to grid
function closeImageViewer(): void {
    if (!imageViewer || !imageGrid || !folderStatus) return

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
