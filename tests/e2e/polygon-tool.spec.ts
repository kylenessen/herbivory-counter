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
})

test.afterAll(async () => {
  await electronApp.close()
  if (testDir && existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true })
  }
})

test.describe('Feature 3.1: User can place polygon vertices by clicking', () => {
  test.beforeAll(async () => {
    await stubDialog(electronApp, 'showOpenDialog', {
      canceled: false,
      filePaths: [testDir]
    })
    await page.click('[data-testid="open-folder"]')
    await page.waitForSelector('#image-grid', { state: 'visible', timeout: 10000 })

    await page.click('.image-thumbnail:first-child')
    await page.waitForSelector('#image-viewer', { state: 'visible', timeout: 5000 })
  })

  test('clicking adds vertices to polygon', async () => {
    await page.click('[data-testid="polygon-mode-btn"]')

    const canvas = page.locator('[data-testid="polygon-canvas"]')
    await expect(canvas).toBeVisible()

    await canvas.click({ position: { x: 100, y: 100 } })
    await canvas.click({ position: { x: 200, y: 100 } })
    await canvas.click({ position: { x: 150, y: 200 } })

    const vertices = await page.evaluate(() => (window as any).polygonVertices)
    expect(vertices).toHaveLength(3)

    await page.screenshot({ path: resolve(__dirname, '../../screenshots/3.1.png') })
  })
})
