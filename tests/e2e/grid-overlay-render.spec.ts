// E2E tests for Grid Overlay Feature 4.2: Render Grid Overlay Inside Polygon Only
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
    testDir = mkdtempSync(join(tmpdir(), 'herbivory-grid-render-test-'))

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

test.describe('Feature 4.2: Grid Overlay Renders Inside Polygon Only', () => {
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

    test('setup: draw and confirm a scale line', async () => {
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
    })

    test('setup: switch to polygon mode and draw closed polygon', async () => {
        // Switch to polygon mode
        await page.click('[data-testid="polygon-mode-btn"]')
        await page.waitForTimeout(200)

        // Ensure we start fresh
        const clearBtn = page.locator('#clear-polygon-btn')
        if (await clearBtn.isVisible()) {
            await clearBtn.click()
        }

        // Draw a closed polygon (simple square)
        const canvas = page.locator('[data-testid="polygon-canvas"]')
        await expect(canvas).toBeVisible()

        // Create a square polygon using element-relative coordinates
        await canvas.click({ position: { x: 200, y: 150 } }) // Top-left
        await page.waitForTimeout(50)
        await canvas.click({ position: { x: 400, y: 150 } }) // Top-right
        await page.waitForTimeout(50)
        await canvas.click({ position: { x: 400, y: 350 } }) // Bottom-right
        await page.waitForTimeout(50)
        await canvas.click({ position: { x: 200, y: 350 } }) // Bottom-left
        await page.waitForTimeout(50)

        // Close the polygon by clicking near the first vertex
        // Get the actual first vertex from window state to be 100% sure
        const firstVertex = await page.evaluate(() => {
            const vertices = (window as any).polygonVertices
            return vertices.length > 0 ? vertices[0] : null
        })

        if (firstVertex) {
            await canvas.click({ position: { x: firstVertex.x, y: firstVertex.y } })
        } else {
            await canvas.click({ position: { x: 200, y: 150 } })
        }

        await page.waitForTimeout(200)

        // Verify polygon is closed
        const polygonClosed = await page.evaluate(() => (window as any).polygonClosed)
        expect(polygonClosed).toBe(true)
    })

    test('grid cells are generated only inside the polygon', async () => {
        // Trigger generic update to ensure state is fresh
        const gridSizeInput = page.locator('#grid-size-input')
        await gridSizeInput.dispatchEvent('input')
        await page.waitForTimeout(100)

        // Check the grid state has cells
        const gridState = await page.evaluate(() => (window as any).gridState)
        expect(gridState).toBeDefined()
        expect(gridState.cells).toBeDefined()
        expect(Array.isArray(gridState.cells)).toBe(true)
        // With debug, we found ~4300 cells were expected theoretically
        expect(gridState.cells.length).toBeGreaterThan(0)

        // All cell centers should be inside the polygon
        const result = await page.evaluate(() => {
            const gridState = (window as any).gridState
            const polygonVertices = (window as any).polygonVertices

            if (!gridState.cells || gridState.cells.length === 0) {
                return { success: false, reason: 'No cells generated' }
            }

            // Simple ray casting check for each cell center
            function isPointInPolygon(point: { x: number; y: number }, vertices: { x: number; y: number }[]): boolean {
                if (vertices.length < 3) return false
                let inside = false
                const x = point.x
                const y = point.y

                for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
                    const xi = vertices[i].x
                    const yi = vertices[i].y
                    const xj = vertices[j].x
                    const yj = vertices[j].y

                    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                        inside = !inside
                    }
                }
                return inside
            }

            // Check all cells
            for (const cell of gridState.cells) {
                if (!isPointInPolygon(cell.center, polygonVertices)) {
                    return {
                        success: false,
                        reason: `Cell at (${cell.center.x}, ${cell.center.y}) is outside polygon`
                    }
                }
            }

            return { success: true, cellCount: gridState.cells.length }
        })

        expect(result.success).toBe(true)
        expect(result.cellCount).toBeGreaterThan(0)
    })

    test('grid is visible on the canvas', async () => {
        // The grid state should indicate visibility when polygon is closed
        const gridState = await page.evaluate(() => (window as any).gridState)
        expect(gridState.isVisible).toBe(true)
    })

    test('grid cells have correct structure', async () => {
        const gridState = await page.evaluate(() => (window as any).gridState)

        // Check first cell has all required properties
        expect(gridState.cells.length).toBeGreaterThan(0)
        const firstCell = gridState.cells[0]

        expect(typeof firstCell.row).toBe('number')
        expect(typeof firstCell.col).toBe('number')
        expect(typeof firstCell.x).toBe('number')
        expect(typeof firstCell.y).toBe('number')
        expect(typeof firstCell.width).toBe('number')
        expect(typeof firstCell.height).toBe('number')
        expect(firstCell.center).toBeDefined()
        expect(typeof firstCell.center.x).toBe('number')
        expect(typeof firstCell.center.y).toBe('number')
    })

    test('cell dimensions match calculated cell size', async () => {
        const gridState = await page.evaluate(() => (window as any).gridState)

        expect(gridState.cellSizePx).toBeGreaterThan(0)

        const firstCell = gridState.cells[0]
        expect(firstCell.width).toBeCloseTo(gridState.cellSizePx, 1)
        expect(firstCell.height).toBeCloseTo(gridState.cellSizePx, 1)
    })

    test('changing grid size updates the cell count', async () => {
        // Get initial cell count
        const initialGridState = await page.evaluate(() => (window as any).gridState)
        const initialCellCount = initialGridState.cells.length

        // Change grid size to 2mm (should reduce cell count)
        const gridSizeInput = page.locator('[data-testid="grid-size-input"]')
        await gridSizeInput.fill('2')
        await gridSizeInput.dispatchEvent('input') // Ensure event fires
        await page.waitForTimeout(200)

        // Cell count should be reduced (larger cells = fewer cells)
        const updatedGridState = await page.evaluate(() => (window as any).gridState)
        expect(updatedGridState.cells.length).toBeLessThan(initialCellCount)

        // Reset grid size back to 1mm
        await gridSizeInput.fill('1')
        await gridSizeInput.dispatchEvent('input')
        await page.waitForTimeout(100)
    })

    test('grid is not visible when polygon is not closed', async () => {
        // Start a new leaf (creates open polygon)
        await page.click('[data-testid="new-leaf-btn"]')
        await page.waitForTimeout(200)

        // Grid should not be visible for open polygon
        const gridState = await page.evaluate(() => (window as any).gridState)
        expect(gridState.isVisible).toBe(false)
        expect(gridState.cells.length).toBe(0)
    })

    test('take screenshot for Feature 4.2 documentation', async () => {
        // Go back to first polygon for screenshot
        const canvas = page.locator('[data-testid="polygon-canvas"]')

        // Click inside the first polygon (approx center of our square: 200,150 -> 400,350. Center is 300, 250)
        // Use canvas relative coordinates
        await canvas.click({ position: { x: 300, y: 250 } })
        await page.waitForTimeout(300)

        // Capture screenshot
        await page.screenshot({ path: resolve(__dirname, '../../screenshots/4.2.png') })
    })
})
