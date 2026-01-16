import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { resolve, join } from 'path'
import { existsSync, mkdtempSync, rmSync, copyFileSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { stubDialog } from 'electron-playwright-helpers'

let electronApp: ElectronApplication
let page: Page
let testDir: string

// Path to the test images folder
const imagesDir = resolve(__dirname, '../../images')

test.beforeAll(async () => {
    // Create test directory and copy test images
    testDir = mkdtempSync(join(tmpdir(), 'herbivory-grid-test-'))

    // Copy test images to the temp directory
    const imageFiles = readdirSync(imagesDir).filter(f =>
        /\.(jpg|jpeg|png|heic|heif)$/i.test(f)
    )
    for (const imageFile of imageFiles) {
        copyFileSync(join(imagesDir, imageFile), join(testDir, imageFile))
    }

    electronApp = await electron.launch({
        args: [resolve(__dirname, '../../dist/main/index.js')]
    })
    page = await electronApp.firstWindow()
})

test.afterAll(async () => {
    await electronApp.close()
    // Clean up test directory
    if (testDir && existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true })
    }
})

test.describe('Feature 1.4: Image grid view shows thumbnails from folder', () => {
    test('open folder button triggers folder selection', async () => {
        const openFolderBtn = page.locator('[data-testid="open-folder"]')
        await expect(openFolderBtn).toBeVisible()
        await expect(openFolderBtn).toBeEnabled()
    })

    test('grid view shows thumbnails after loading folder', async () => {
        // Stub the dialog to return our test directory
        await stubDialog(electronApp, 'showOpenDialog', {
            canceled: false,
            filePaths: [testDir]
        })

        // Click open folder
        await page.click('[data-testid="open-folder"]')

        // Wait for grid to appear
        await page.waitForSelector('#image-grid', { state: 'visible', timeout: 10000 })

        // Verify thumbnails are shown
        const thumbnails = page.locator('.image-thumbnail')
        await expect(thumbnails).toHaveCount(8) // 8 images in test folder
    })

    test('each thumbnail displays an image', async () => {
        const thumbnails = page.locator('.image-thumbnail img')
        await expect(thumbnails.first()).toBeVisible()

        // Check that images have valid src
        const firstSrc = await thumbnails.first().getAttribute('src')
        expect(firstSrc).toBeTruthy()
        expect(firstSrc).toMatch(/file:\/\//)
    })

    test('thumbnails display filename', async () => {
        const thumbnails = page.locator('.image-thumbnail')
        const firstThumbnail = thumbnails.first()

        // Should have a label with filename
        const label = firstThumbnail.locator('.thumbnail-label')
        await expect(label).toBeVisible()
        const labelText = await label.textContent()
        expect(labelText).toMatch(/\.JPG/i)
    })

    test('clicking thumbnail opens full image view', async () => {
        // Click first thumbnail
        await page.click('.image-thumbnail:first-child')

        // Verify full image view appears
        await page.waitForSelector('#image-viewer', { state: 'visible', timeout: 5000 })

        // Viewer should have an image
        const viewerImage = page.locator('#image-viewer .viewer-image')
        await expect(viewerImage).toBeVisible()
    })

    test('full image view has back button to return to grid', async () => {
        // Verify back button exists and works
        const backBtn = page.locator('[data-testid="back-to-grid"]')
        await expect(backBtn).toBeVisible()

        await backBtn.click()

        // Grid should be visible again
        await page.waitForSelector('#image-grid', { state: 'visible', timeout: 5000 })
    })
})
