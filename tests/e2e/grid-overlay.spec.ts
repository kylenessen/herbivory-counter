// E2E tests for Grid Overlay Feature 4.1: Calculate Grid Size from Scale
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

test.describe('Feature 4.1: Grid Cell Size Calculated from Scale', () => {
    test.beforeAll(async () => {
        // Open folder first to get to image grid
        await stubDialog(electronApp, 'showOpenDialog', {
            canceled: false,
            filePaths: [testDir]
        })
        await page.click('[data-testid="open-folder"]')
        await page.waitForSelector('#image-grid', { state: 'visible', timeout: 10000 })

        // Open first image
        await page.click('.image-thumbnail:first-child')
        await page.waitForSelector('#image-viewer', { state: 'visible', timeout: 5000 })
    })

    test('scale mode is default - draw and confirm a scale line', async () => {
        // Draw a scale line
        const canvas = page.locator('[data-testid="scale-canvas"]')
        const box = await canvas.boundingBox()
        if (!box) throw new Error('Canvas not found')

        // Draw a line of ~300 pixels
        await page.mouse.move(box.x + 100, box.y + 200)
        await page.mouse.down()
        await page.mouse.move(box.x + 400, box.y + 200)
        await page.mouse.up()

        // Confirm the scale line
        await page.click('#confirm-scale-btn')
        await page.waitForSelector('[data-testid="scale-input-dialog"]', { state: 'visible' })

        // Enter 10 cm and confirm
        const cmInput = page.locator('[data-testid="scale-cm-input"]')
        await cmInput.fill('10')
        await page.click('[data-testid="confirm-scale-value-btn"]')

        // Wait for scale to be set
        await page.waitForSelector('[data-testid="scale-display"]', { state: 'visible' })

        // Verify scale is set
        const scaleValue = await page.evaluate(() => (window as any).scaleValue)
        expect(scaleValue).toBeDefined()
        expect(scaleValue.pxPerCm).toBeGreaterThan(0)
    })

    test('grid size input is visible in polygon mode when scale is set', async () => {
        // Switch to polygon mode
        await page.click('[data-testid="polygon-mode-btn"]')
        await page.waitForTimeout(200)

        // Grid controls should be visible in polygon section
        const gridSizeInput = page.locator('[data-testid="grid-size-input"]')
        await expect(gridSizeInput).toBeVisible()
    })

    test('grid size input has default value of 1 mm', async () => {
        const gridSizeInput = page.locator('[data-testid="grid-size-input"]')
        const value = await gridSizeInput.inputValue()
        expect(value).toBe('1')
    })

    test('grid cell size display shows calculated value', async () => {
        // Cell size display should be visible and show calculated value
        const cellSizeDisplay = page.locator('[data-testid="grid-cell-size-display"]')
        await expect(cellSizeDisplay).toBeVisible()

        // With scale set, cell size should be non-zero
        const displayText = await cellSizeDisplay.textContent()
        expect(displayText).toContain('px')

        // Check the actual grid state
        const gridState = await page.evaluate(() => (window as any).gridState)
        expect(gridState).toBeDefined()
        expect(gridState.gridSizeMm).toBe(1)
        expect(gridState.cellSizePx).toBeGreaterThan(0)
    })

    test('grid cell size updates when grid size changes', async () => {
        // Get initial cell size
        const initialGridState = await page.evaluate(() => (window as any).gridState)
        const initialCellSize = initialGridState.cellSizePx

        // Change grid size to 2mm
        const gridSizeInput = page.locator('[data-testid="grid-size-input"]')
        await gridSizeInput.fill('2')
        await gridSizeInput.blur()
        await page.waitForTimeout(100)

        // Cell size should double
        const updatedGridState = await page.evaluate(() => (window as any).gridState)
        expect(updatedGridState.gridSizeMm).toBe(2)
        expect(updatedGridState.cellSizePx).toBeCloseTo(initialCellSize * 2, 1)

        // UI should show updated value
        const cellSizeDisplay = page.locator('[data-testid="grid-cell-size-display"]')
        const cellSizeValue = page.locator('#grid-cell-size-value')
        const displayValue = await cellSizeValue.textContent()
        expect(parseFloat(displayValue || '0')).toBeCloseTo(updatedGridState.cellSizePx, 1)
    })

    test('grid state is accessible via window object for testing', async () => {
        // Verify grid state is exposed correctly
        const gridState = await page.evaluate(() => (window as any).gridState)

        expect(gridState).toBeDefined()
        expect(typeof gridState.gridSizeMm).toBe('number')
        expect(typeof gridState.cellSizePx).toBe('number')
        expect(gridState.gridSizeMm).toBeGreaterThan(0)
        expect(gridState.cellSizePx).toBeGreaterThan(0)
    })

    test('invalid grid size values are corrected', async () => {
        const gridSizeInput = page.locator('[data-testid="grid-size-input"]')

        // Try to set an invalid value (0)
        await gridSizeInput.fill('0')
        await gridSizeInput.blur()
        await page.waitForTimeout(100)

        // Should reset to valid default value (1)
        const correctedValue = await gridSizeInput.inputValue()
        expect(parseFloat(correctedValue)).toBe(1)

        // Grid state should reflect valid value
        const gridState = await page.evaluate(() => (window as any).gridState)
        expect(gridState.gridSizeMm).toBe(1)
    })

    test('take screenshot for Feature 4.1 documentation', async () => {
        // Reset grid size to 1mm for screenshot
        const gridSizeInput = page.locator('[data-testid="grid-size-input"]')
        await gridSizeInput.fill('1')
        await gridSizeInput.blur()
        await page.waitForTimeout(100)

        // Capture screenshot
        await page.screenshot({ path: resolve(__dirname, '../../screenshots/4.1.png') })
    })
})
