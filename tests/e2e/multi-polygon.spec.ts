import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { resolve, join } from 'path'
import { existsSync, mkdtempSync, rmSync, copyFileSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { stubDialog } from 'electron-playwright-helpers'

let electronApp: ElectronApplication
let page: Page
let testDir: string

const imagesDir = resolve(__dirname, '../../images')

test.beforeAll(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'herbivory-multi-polygon-test-'))

    const imageFiles = readdirSync(imagesDir).filter(f => /\.(jpg|jpeg|png|heic|heif)$/i.test(f))
    for (const imageFile of imageFiles) {
        copyFileSync(join(imagesDir, imageFile), join(testDir, imageFile))
    }

    electronApp = await electron.launch({
        args: [resolve(__dirname, '../../dist/main/index.js')]
    })
    page = await electronApp.firstWindow()

    await page.waitForSelector('[data-testid="open-folder"]', { state: 'visible', timeout: 10000 })
    await page.waitForFunction(() => typeof (window as any).electronAPI !== 'undefined')

    await stubDialog(electronApp, 'showOpenDialog', {
        canceled: false,
        filePaths: [testDir]
    })
    await page.click('[data-testid="open-folder"]')
    await page.waitForSelector('#image-grid', { state: 'visible', timeout: 10000 })

    await page.click('.image-thumbnail:first-child')
    await page.waitForSelector('#image-viewer', { state: 'visible', timeout: 5000 })
})

test.afterAll(async () => {
    await electronApp.close()
    if (testDir && existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true })
    }
})

test.describe('Feature 3.7: Multiple Polygons Per Image', () => {
    test('can create and close first polygon with leaf ID 01', async () => {
        await page.click('[data-testid="polygon-mode-btn"]')
        await page.click('#clear-polygon-btn')

        const canvas = page.locator('[data-testid="polygon-canvas"]')
        await expect(canvas).toBeVisible()

        // Check initial leaf display
        await expect(page.locator('#active-leaf-display')).toHaveText('Leaf: 01')

        // Draw first polygon (triangle)
        await canvas.click({ position: { x: 100, y: 100 } })
        await canvas.click({ position: { x: 200, y: 100 } })
        await canvas.click({ position: { x: 150, y: 200 } })
        await canvas.click({ position: { x: 102, y: 102 } }) // Close near first vertex

        const vertices1 = await page.evaluate(() => (window as any).polygonVertices)
        expect(vertices1).toHaveLength(3)

        const closed = await page.evaluate(() => (window as any).polygonClosed)
        expect(closed).toBe(true)

        // Verify leaf display still shows 01
        await expect(page.locator('#active-leaf-display')).toHaveText('Leaf: 01')

        // Verify New Leaf button is visible after closing
        await expect(page.locator('[data-testid="new-leaf-btn"]')).toBeVisible()
    })

    test('New Leaf button creates second polygon with leaf ID 02', async () => {
        // Click New Leaf button
        await page.click('[data-testid="new-leaf-btn"]')

        // Verify leaf display now shows 02
        await expect(page.locator('#active-leaf-display')).toHaveText('Leaf: 02')

        // Verify canvas is cleared for new polygon
        const vertices = await page.evaluate(() => (window as any).polygonVertices)
        expect(vertices).toHaveLength(0)

        const closed = await page.evaluate(() => (window as any).polygonClosed)
        expect(closed).toBe(false)

        // Verify New Leaf button is hidden
        await expect(page.locator('[data-testid="new-leaf-btn"]')).not.toBeVisible()

        // Draw second polygon
        const canvas = page.locator('[data-testid="polygon-canvas"]')
        await canvas.click({ position: { x: 300, y: 100 } })
        await canvas.click({ position: { x: 400, y: 100 } })
        await canvas.click({ position: { x: 350, y: 200 } })
        await canvas.click({ position: { x: 302, y: 102 } }) // Close near first vertex

        const vertices2 = await page.evaluate(() => (window as any).polygonVertices)
        expect(vertices2).toHaveLength(3)

        // Verify leaf display still shows 02
        await expect(page.locator('#active-leaf-display')).toHaveText('Leaf: 02')
    })

    test('allPolygons contains both polygons', async () => {
        const allPolygons = await page.evaluate(() => (window as any).allPolygons)
        expect(allPolygons).toHaveLength(2)
        expect(allPolygons[0].leafId).toBe('01')
        expect(allPolygons[1].leafId).toBe('02')
        expect(allPolygons[0].closed).toBe(true)
        expect(allPolygons[1].closed).toBe(true)
    })

    test('clicking inside first polygon selects it', async () => {
        // Ensure in polygon mode
        await page.click('[data-testid="polygon-mode-btn"]')

        const canvas = page.locator('[data-testid="polygon-canvas"]')

        // Currently on leaf 02, click inside first polygon (approx centroid at 150, 133)
        await canvas.click({ position: { x: 150, y: 133 } })

        // Should switch to leaf 01
        await expect(page.locator('#active-leaf-display')).toHaveText('Leaf: 01')

        const activeLeafId = await page.evaluate(() => (window as any).activeLeafId)
        expect(activeLeafId).toBe('01')

        // Vertices should be the first polygon's vertices (using approximate matching)
        const vertices = await page.evaluate(() => (window as any).polygonVertices)
        expect(vertices).toHaveLength(3)
        expect(vertices[0].x).toBeGreaterThan(95)
        expect(vertices[0].x).toBeLessThan(105)
    })

    test('clicking inside second polygon selects it back', async () => {
        // Ensure in polygon mode
        await page.click('[data-testid="polygon-mode-btn"]')

        const canvas = page.locator('[data-testid="polygon-canvas"]')

        // Click inside second polygon (approx centroid at 350, 133)
        await canvas.click({ position: { x: 350, y: 133 } })

        // Should switch to leaf 02
        await expect(page.locator('#active-leaf-display')).toHaveText('Leaf: 02')

        const activeLeafId = await page.evaluate(() => (window as any).activeLeafId)
        expect(activeLeafId).toBe('02')

        await page.screenshot({ path: resolve(__dirname, '../../screenshots/3.7.png') })
    })
})
