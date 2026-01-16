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
