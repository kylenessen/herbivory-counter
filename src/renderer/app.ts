// Main renderer entry point
console.log('Herbivory Counter initialized')

// Get DOM elements
const openFolderBtn = document.getElementById('open-folder-btn')
const welcomeSection = document.getElementById('welcome-section')
const folderStatus = document.getElementById('folder-status')
const folderPathSpan = document.getElementById('folder-path')
const databaseStatusSpan = document.getElementById('database-status')
const imageCountSpan = document.getElementById('image-count')
const tableListSpan = document.getElementById('table-list')

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

        console.log('Folder opened successfully:', result)
    } catch (error) {
        console.error('Error opening folder:', error)
        alert(`Error: ${error}`)
    }
})

