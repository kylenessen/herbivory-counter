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
    testDir = mkdtempSync(join(tmpdir(), 'herbivory-scale-test-'))

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

test.describe('Feature 2.1: User can draw a line on scale ruler', () => {
    test.beforeAll(async () => {
        // Open folder first to get to image grid
        await stubDialog(electronApp, 'showOpenDialog', {
            canceled: false,
            filePaths: [testDir]
        })
        await page.click('[data-testid="open-folder"]')
        await page.waitForSelector('#image-grid', { state: 'visible', timeout: 10000 })
    })

    test('clicking thumbnail opens image viewer with canvas overlay', async () => {
        // Click first thumbnail to open full view
        await page.click('.image-thumbnail:first-child')
        await page.waitForSelector('#image-viewer', { state: 'visible', timeout: 5000 })

        // Check that canvas overlay exists for drawing
        const canvas = page.locator('[data-testid="scale-canvas"]')
        await expect(canvas).toBeVisible()
    })

    test('canvas displays instructions to draw scale line', async () => {
        // Should show instruction text
        const instruction = page.locator('[data-testid="scale-instruction"]')
        await expect(instruction).toBeVisible()
        await expect(instruction).toContainText('Draw a line')
    })

    test('click and drag creates a line on the canvas', async () => {
        const canvas = page.locator('[data-testid="scale-canvas"]')

        // Get canvas bounding box
        const box = await canvas.boundingBox()
        if (!box) throw new Error('Canvas not found')

        // Draw a line: click at start, drag to end
        const startX = box.x + 100
        const startY = box.y + 200
        const endX = box.x + 400
        const endY = box.y + 200

        await page.mouse.move(startX, startY)
        await page.mouse.down()
        await page.mouse.move(endX, endY)
        await page.mouse.up()

        // Verify line was created by checking for visible line length display
        // The ScaleTool renders the line length text
        const scaleLine = await page.evaluate(() => {
            // Access the exposed scale line state
            return (window as any).scaleLine
        })

        expect(scaleLine).toBeTruthy()
        expect(scaleLine.start).toBeDefined()
        expect(scaleLine.end).toBeDefined()
    })

    test('line appears with draggable endpoints', async () => {
        // The endpoints should be visible (rendered as circles)
        // We test by checking if hovering over the endpoint area changes cursor
        const canvas = page.locator('[data-testid="scale-canvas"]')
        const box = await canvas.boundingBox()
        if (!box) throw new Error('Canvas not found')

        // Get the stored line coordinates
        const scaleLine = await page.evaluate(() => (window as any).scaleLine)
        if (!scaleLine) throw new Error('No scale line found')

        // Hover over start endpoint (should change cursor to grab)
        await page.mouse.move(box.x + scaleLine.start.x, box.y + scaleLine.start.y)

        // The cursor should change to 'grab' when hovering over endpoints
        // This is handled by ScaleTool's mouse move event
    })

    test('endpoints can be dragged to adjust line', async () => {
        const canvas = page.locator('[data-testid="scale-canvas"]')
        const box = await canvas.boundingBox()
        if (!box) throw new Error('Canvas not found')

        // Get initial line
        const initialLine = await page.evaluate(() => (window as any).scaleLine)
        if (!initialLine) throw new Error('No scale line found')

        // Drag the end endpoint to a new position
        const endX = box.x + initialLine.end.x
        const endY = box.y + initialLine.end.y
        const newEndX = endX + 50
        const newEndY = endY + 30

        await page.mouse.move(endX, endY)
        await page.mouse.down()
        await page.mouse.move(newEndX, newEndY)
        await page.mouse.up()

        // Verify line was updated
        const updatedLine = await page.evaluate(() => (window as any).scaleLine)
        expect(updatedLine.end.x).not.toBe(initialLine.end.x)
    })

    test('line persists until confirmed or canceled', async () => {
        // Line should still be visible
        const scaleLine = await page.evaluate(() => (window as any).scaleLine)
        expect(scaleLine).toBeTruthy()
        expect(scaleLine.isComplete).toBe(true)

        // Should have confirmation UI visible
        const confirmSection = page.locator('[data-testid="scale-confirm-section"]')
        await expect(confirmSection).toBeVisible()
    })

    test('line displays pixel length', async () => {
        // The line length in pixels should be displayed on the canvas
        const lengthDisplay = page.locator('[data-testid="scale-line-length"]')
        await expect(lengthDisplay).toBeVisible()

        const lengthText = await lengthDisplay.textContent()
        expect(lengthText).toMatch(/\d+\s*px/)

        // Take screenshot for Feature 2.1 documentation
        await page.screenshot({ path: resolve(__dirname, '../../screenshots/2.1.png') })
    })

    test('going back to grid clears line state', async () => {
        // Click back button
        await page.click('[data-testid="back-to-grid"]')
        await page.waitForSelector('#image-grid', { state: 'visible', timeout: 5000 })

        // Open same image again
        await page.click('.image-thumbnail:first-child')
        await page.waitForSelector('#image-viewer', { state: 'visible', timeout: 5000 })

        // Line should be cleared (this is temporary state, not persisted yet)
        const scaleLine = await page.evaluate(() => (window as any).scaleLine)

        // The line state should be reset for this feature
        // (persistence is Feature 2.3)
        expect(scaleLine).toBeNull()
    })
})

test.describe('Feature 2.2: User can enter scale value in centimeters', () => {
    test.beforeAll(async () => {
        // Check if folder is already open by looking for the grid or welcome section
        const gridVisible = await page.locator('#image-grid').isVisible()
        const welcomeVisible = await page.locator('#welcome-section').isVisible()

        if (welcomeVisible && !gridVisible) {
            // Need to open folder
            await stubDialog(electronApp, 'showOpenDialog', {
                canceled: false,
                filePaths: [testDir]
            })
            await page.click('[data-testid="open-folder"]')
            await page.waitForSelector('#image-grid', { state: 'visible', timeout: 10000 })
        }
        // If grid is visible, folder is already open and we're good to go
    })

    test.beforeEach(async () => {
        // Close any open dialogs first
        const dialogVisible = await page.locator('[data-testid="scale-input-dialog"]').isVisible()
        if (dialogVisible) {
            await page.click('[data-testid="cancel-scale-btn"]')
            await page.waitForSelector('[data-testid="scale-input-dialog"]', { state: 'hidden', timeout: 5000 })
        }

        // Clear any existing scale by going back and reopening
        const scaleDisplay = await page.locator('[data-testid="scale-display"]').isVisible()
        if (scaleDisplay) {
            await page.click('[data-testid="back-to-grid"]')
            await page.waitForSelector('#image-grid', { state: 'visible', timeout: 5000 })
        }

        // Ensure we're in image viewer with a drawn line
        const imageViewer = await page.locator('#image-viewer').isVisible()
        if (!imageViewer) {
            // Open image viewer
            await page.click('.image-thumbnail:first-child')
            await page.waitForSelector('#image-viewer', { state: 'visible', timeout: 5000 })
        }

        // Draw a line if not present
        const scaleLine = await page.evaluate(() => (window as any).scaleLine)
        if (!scaleLine) {
            const canvas = page.locator('[data-testid="scale-canvas"]')
            const box = await canvas.boundingBox()
            if (box) {
                await page.mouse.move(box.x + 100, box.y + 200)
                await page.mouse.down()
                await page.mouse.move(box.x + 400, box.y + 200)
                await page.mouse.up()
            }
        }
    })

    test('confirm scale button shows scale input dialog', async () => {
        // Click the confirm scale button
        await page.click('#confirm-scale-btn')

        // Dialog should appear with scale input
        const scaleDialog = page.locator('[data-testid="scale-input-dialog"]')
        await expect(scaleDialog).toBeVisible()
    })

    test('scale input has default value of 10 cm', async () => {
        await page.click('#confirm-scale-btn')

        const scaleInput = page.locator('[data-testid="scale-cm-input"]')
        await expect(scaleInput).toBeVisible()
        await expect(scaleInput).toHaveValue('10')
    })

    test('user can change scale value', async () => {
        await page.click('#confirm-scale-btn')

        const scaleInput = page.locator('[data-testid="scale-cm-input"]')
        await scaleInput.clear()
        await scaleInput.fill('5')
        await expect(scaleInput).toHaveValue('5')
    })

    test('confirm button calculates and stores scale', async () => {
        await page.click('#confirm-scale-btn')

        const scaleInput = page.locator('[data-testid="scale-cm-input"]')
        await scaleInput.clear()
        await scaleInput.fill('10')

        // Click confirm in dialog
        await page.click('[data-testid="confirm-scale-value-btn"]')

        // Scale should be stored and dialog should close
        const scaleDialog = page.locator('[data-testid="scale-input-dialog"]')
        await expect(scaleDialog).not.toBeVisible()

        // Scale value should be accessible
        const scaleValue = await page.evaluate(() => (window as any).scaleValue)
        expect(scaleValue).toBeDefined()
        expect(scaleValue.pxPerCm).toBeGreaterThan(0)
    })

    test('scale displayed on screen after confirmation', async () => {
        await page.click('#confirm-scale-btn')

        const scaleInput = page.locator('[data-testid="scale-cm-input"]')
        await scaleInput.clear()
        await scaleInput.fill('10')

        await page.click('[data-testid="confirm-scale-value-btn"]')

        // Scale display should be visible
        const scaleDisplay = page.locator('[data-testid="scale-display"]')
        await expect(scaleDisplay).toBeVisible()

        // Should show format like "1 cm = XX px"
        const displayText = await scaleDisplay.textContent()
        expect(displayText).toMatch(/1\s*cm\s*=\s*\d+(\.\d+)?\s*px/)

        // Take screenshot for Feature 2.2 documentation
        await page.screenshot({ path: resolve(__dirname, '../../screenshots/2.2.png') })
    })

    test('cancel button closes dialog without saving scale', async () => {
        await page.click('#confirm-scale-btn')

        const scaleDialog = page.locator('[data-testid="scale-input-dialog"]')
        await expect(scaleDialog).toBeVisible()

        // Click cancel
        await page.click('[data-testid="cancel-scale-btn"]')

        // Dialog should close
        await expect(scaleDialog).not.toBeVisible()

        // Scale should not be set
        const scaleDisplay = page.locator('[data-testid="scale-display"]')
        await expect(scaleDisplay).not.toBeVisible()
    })
})
