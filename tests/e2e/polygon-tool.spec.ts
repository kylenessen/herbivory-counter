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
  testDir = mkdtempSync(join(tmpdir(), 'herbivory-polygon-test-'))

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

test.describe('Feature 3.1: User can place polygon vertices by clicking', () => {
  test('clicking adds vertices to polygon', async () => {
    await page.click('[data-testid="polygon-mode-btn"]')
    await page.click('#clear-polygon-btn')

    const canvas = page.locator('[data-testid="polygon-canvas"]')
    await expect(canvas).toBeVisible()

    await canvas.click({ position: { x: 100, y: 100 } })
    await canvas.click({ position: { x: 200, y: 100 } })
    await canvas.click({ position: { x: 150, y: 200 } })

    const vertices = await page.evaluate(() => (window as any).polygonVertices)
    expect(vertices).toHaveLength(3)
  })
})

test.describe('Feature 3.2: Polygon closes when clicking near first vertex', () => {
  test('clicking near first vertex closes polygon and prevents adding more points', async () => {
    await page.click('[data-testid="polygon-mode-btn"]')
    await page.click('#clear-polygon-btn')

    const canvas = page.locator('[data-testid="polygon-canvas"]')
    await expect(canvas).toBeVisible()

    await canvas.click({ position: { x: 100, y: 100 } })
    await canvas.click({ position: { x: 200, y: 100 } })
    await canvas.click({ position: { x: 150, y: 200 } })

    await canvas.click({ position: { x: 102, y: 98 } })

    const closed = await page.evaluate(() => (window as any).polygonClosed)
    expect(closed).toBe(true)

    const verticesAfterClose = await page.evaluate(() => (window as any).polygonVertices)
    expect(verticesAfterClose).toHaveLength(3)

    await canvas.click({ position: { x: 250, y: 250 } })
    const verticesAfterExtraClick = await page.evaluate(() => (window as any).polygonVertices)
    expect(verticesAfterExtraClick).toHaveLength(3)

    await page.screenshot({ path: resolve(__dirname, '../../screenshots/3.2.png') })
  })
})

test.describe('Feature 3.3: User can drag vertices to adjust polygon', () => {
  test('hovering a vertex shows move cursor and dragging updates vertices (closed polygon)', async () => {
    await page.click('[data-testid="polygon-mode-btn"]')
    await page.click('#clear-polygon-btn')

    const canvas = page.locator('[data-testid="polygon-canvas"]')
    await expect(canvas).toBeVisible()

    await canvas.click({ position: { x: 100, y: 100 } })
    await canvas.click({ position: { x: 200, y: 100 } })
    await canvas.click({ position: { x: 150, y: 200 } })
    await canvas.click({ position: { x: 102, y: 98 } }) // Close near first vertex

    const box = await canvas.boundingBox()
    if (!box) throw new Error('Could not get polygon canvas bounding box')

    await page.mouse.move(box.x + 100, box.y + 100)
    const cursor = await canvas.evaluate((el) => getComputedStyle(el).cursor)
    expect(cursor).toBe('move')

    await page.mouse.move(box.x + 100, box.y + 100)
    await page.mouse.down()
    await page.mouse.move(box.x + 50, box.y + 50, { steps: 10 })
    await page.mouse.up()

    const vertices = await page.evaluate(() => (window as any).polygonVertices)
    expect(vertices).toHaveLength(3)
    expect(vertices[0].x).toBeGreaterThan(40)
    expect(vertices[0].x).toBeLessThan(60)
    expect(vertices[0].y).toBeGreaterThan(40)
    expect(vertices[0].y).toBeLessThan(60)

    await page.screenshot({ path: resolve(__dirname, '../../screenshots/3.3.png') })
  })

  test('dragging works on open polygon', async () => {
    await page.click('[data-testid="polygon-mode-btn"]')
    await page.click('#clear-polygon-btn')

    const canvas = page.locator('[data-testid="polygon-canvas"]')
    await expect(canvas).toBeVisible()

    await canvas.click({ position: { x: 100, y: 100 } })
    await canvas.click({ position: { x: 200, y: 100 } })
    await canvas.click({ position: { x: 150, y: 200 } })

    const box = await canvas.boundingBox()
    if (!box) throw new Error('Could not get polygon canvas bounding box')

    await page.mouse.move(box.x + 200, box.y + 100)
    await page.mouse.down()
    await page.mouse.move(box.x + 220, box.y + 120, { steps: 10 })
    await page.mouse.up()

    const vertices = await page.evaluate(() => (window as any).polygonVertices)
    expect(vertices).toHaveLength(3)
    expect(vertices[1].x).toBeGreaterThan(210)
    expect(vertices[1].x).toBeLessThan(230)
    expect(vertices[1].y).toBeGreaterThan(110)
    expect(vertices[1].y).toBeLessThan(130)
  })
})

test.describe('Feature 3.4: User can delete individual vertices', () => {
  test('deleting vertex updates polygon', async () => {
    await page.click('[data-testid="polygon-mode-btn"]')
    await page.click('#clear-polygon-btn')

    const canvas = page.locator('[data-testid="polygon-canvas"]')
    await expect(canvas).toBeVisible()

    await canvas.click({ position: { x: 100, y: 100 } })
    await canvas.click({ position: { x: 200, y: 100 } })
    await canvas.click({ position: { x: 250, y: 150 } })
    await canvas.click({ position: { x: 150, y: 200 } })

    const before = await page.evaluate(() => (window as any).polygonVertices)
    expect(before).toHaveLength(4)

    await canvas.click({ position: { x: 200, y: 100 } }) // select vertex 1
    await page.keyboard.press('Delete')

    const after = await page.evaluate(() => (window as any).polygonVertices)
    expect(after).toHaveLength(3)
    expect(after[1].x).toBe(before[2].x)
    expect(after[1].y).toBe(before[2].y)

    await page.screenshot({ path: resolve(__dirname, '../../screenshots/3.4.png') })
  })

  test('cannot delete below 3 vertices', async () => {
    await page.click('[data-testid="polygon-mode-btn"]')
    await page.click('#clear-polygon-btn')

    const canvas = page.locator('[data-testid="polygon-canvas"]')
    await expect(canvas).toBeVisible()

    await canvas.click({ position: { x: 100, y: 100 } })
    await canvas.click({ position: { x: 200, y: 100 } })
    await canvas.click({ position: { x: 150, y: 200 } })

    const before = await page.evaluate(() => (window as any).polygonVertices)
    expect(before).toHaveLength(3)

    await canvas.click({ position: { x: 100, y: 100 } }) // select vertex 0
    await page.keyboard.press('Delete')

    const after = await page.evaluate(() => (window as any).polygonVertices)
    expect(after).toHaveLength(3)
  })
})

test.describe('Feature 3.5: Undo reverts polygon operations', () => {
  const modKey = process.platform === 'darwin' ? 'Meta' : 'Control'

  test('Cmd+Z undoes last vertex addition', async () => {
    await page.click('[data-testid="polygon-mode-btn"]')
    await page.click('#clear-polygon-btn')

    const canvas = page.locator('[data-testid="polygon-canvas"]')
    await expect(canvas).toBeVisible()

    await canvas.click({ position: { x: 100, y: 100 } })
    await canvas.click({ position: { x: 200, y: 100 } })

    const beforeUndo = await page.evaluate(() => (window as any).polygonVertices)
    expect(beforeUndo).toHaveLength(2)

    await page.keyboard.press(`${modKey}+Z`)

    const afterUndo = await page.evaluate(() => (window as any).polygonVertices)
    expect(afterUndo).toHaveLength(1)
  })

  test('Cmd+Z undoes vertex move', async () => {
    await page.click('[data-testid="polygon-mode-btn"]')
    await page.click('#clear-polygon-btn')

    const canvas = page.locator('[data-testid="polygon-canvas"]')
    await expect(canvas).toBeVisible()

    await canvas.click({ position: { x: 100, y: 100 } })
    await canvas.click({ position: { x: 200, y: 100 } })
    await canvas.click({ position: { x: 150, y: 200 } })

    const beforeMove = await page.evaluate(() => (window as any).polygonVertices)
    expect(beforeMove).toHaveLength(3)

    const box = await canvas.boundingBox()
    if (!box) throw new Error('Could not get polygon canvas bounding box')

    await page.mouse.move(box.x + 100, box.y + 100)
    await page.mouse.down()
    await page.mouse.move(box.x + 50, box.y + 50, { steps: 10 })
    await page.mouse.up()

    const afterMove = await page.evaluate(() => (window as any).polygonVertices)
    expect(afterMove).toHaveLength(3)
    expect(afterMove[0].x).toBeLessThan(70)
    expect(afterMove[0].y).toBeLessThan(70)

    await page.keyboard.press(`${modKey}+Z`)

    const afterUndo = await page.evaluate(() => (window as any).polygonVertices)
    expect(afterUndo).toHaveLength(3)
    expect(afterUndo[0].x).toBeGreaterThan(90)
    expect(afterUndo[0].x).toBeLessThan(110)
    expect(afterUndo[0].y).toBeGreaterThan(90)
    expect(afterUndo[0].y).toBeLessThan(110)
  })

  test('Cmd+Z undoes vertex delete', async () => {
    await page.click('[data-testid="polygon-mode-btn"]')
    await page.click('#clear-polygon-btn')

    const canvas = page.locator('[data-testid="polygon-canvas"]')
    await expect(canvas).toBeVisible()

    await canvas.click({ position: { x: 100, y: 100 } })
    await canvas.click({ position: { x: 200, y: 100 } })
    await canvas.click({ position: { x: 250, y: 150 } })
    await canvas.click({ position: { x: 150, y: 200 } })

    const beforeDelete = await page.evaluate(() => (window as any).polygonVertices)
    expect(beforeDelete).toHaveLength(4)

    await canvas.click({ position: { x: 200, y: 100 } }) // select vertex 1
    await page.keyboard.press('Delete')

    const afterDelete = await page.evaluate(() => (window as any).polygonVertices)
    expect(afterDelete).toHaveLength(3)

    await page.keyboard.press(`${modKey}+Z`)

    const afterUndo = await page.evaluate(() => (window as any).polygonVertices)
    expect(afterUndo).toHaveLength(4)
    expect(afterUndo[1].x).toBe(beforeDelete[1].x)
    expect(afterUndo[1].y).toBe(beforeDelete[1].y)

    await page.screenshot({ path: resolve(__dirname, '../../screenshots/3.5.png') })
  })
})

test.describe('Feature 3.6: Polygon deletion', () => {
  test('deleting polygon prompts for confirmation and clears polygon', async () => {
    await page.click('[data-testid="polygon-mode-btn"]')
    await page.click('#clear-polygon-btn')

    const canvas = page.locator('[data-testid="polygon-canvas"]')
    await expect(canvas).toBeVisible()

    await canvas.click({ position: { x: 100, y: 100 } })
    await canvas.click({ position: { x: 200, y: 100 } })
    await canvas.click({ position: { x: 150, y: 200 } })
    await canvas.click({ position: { x: 102, y: 98 } }) // close near first vertex

    await expect(page.locator('[data-testid="polygon-delete-btn"]')).toBeVisible()

    await page.click('[data-testid="polygon-delete-btn"]')
    const dialog = page.locator('[data-testid="polygon-delete-dialog"]')
    await expect(dialog).toBeVisible()

    await page.click('[data-testid="polygon-delete-cancel-btn"]')
    await expect(dialog).not.toBeVisible()

    const stillClosed = await page.evaluate(() => (window as any).polygonClosed)
    expect(stillClosed).toBe(true)

    await page.click('[data-testid="polygon-delete-btn"]')
    await expect(dialog).toBeVisible()
    await page.click('[data-testid="polygon-delete-confirm-btn"]')
    await expect(dialog).not.toBeVisible()

    const verticesAfter = await page.evaluate(() => (window as any).polygonVertices)
    expect(verticesAfter).toHaveLength(0)
    const closedAfter = await page.evaluate(() => (window as any).polygonClosed)
    expect(closedAfter).toBe(false)

    await page.screenshot({ path: resolve(__dirname, '../../screenshots/3.6.png') })
  })
})
