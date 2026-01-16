import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { resolve, join } from 'path'
import { existsSync, mkdtempSync, rmSync, copyFileSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { stubDialog } from 'electron-playwright-helpers'

let testDir: string

const imagesDir = resolve(__dirname, '../../images')

function getElectronLaunchEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [resolve(__dirname, '../../dist/main/index.js')],
    env: getElectronLaunchEnv()
  })
  const page = await app.firstWindow()
  return { app, page }
}

test.beforeAll(() => {
  testDir = mkdtempSync(join(tmpdir(), 'herbivory-scale-persist-test-'))

  const imageFiles = readdirSync(imagesDir).filter(f =>
    /\.(jpg|jpeg|png|heic|heif)$/i.test(f)
  )
  for (const imageFile of imageFiles) {
    copyFileSync(join(imagesDir, imageFile), join(testDir, imageFile))
  }
})

test.afterAll(() => {
  if (testDir && existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true })
  }
})

test.describe('Feature 2.3: Scale persists across app restarts', () => {
  test('confirmed scale is restored after relaunch', async () => {
    // First run: set the scale
    let { app: electronApp, page } = await launchApp()

    await stubDialog(electronApp, 'showOpenDialog', {
      canceled: false,
      filePaths: [testDir]
    })
    await page.click('[data-testid="open-folder"]')
    await page.waitForSelector('#image-grid', { state: 'visible', timeout: 10000 })

    await page.click('.image-thumbnail:first-child')
    await page.waitForSelector('#image-viewer', { state: 'visible', timeout: 5000 })

    const canvas = page.locator('[data-testid="scale-canvas"]')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')

    await page.mouse.move(box.x + 100, box.y + 200)
    await page.mouse.down()
    await page.mouse.move(box.x + 400, box.y + 200)
    await page.mouse.up()

    await page.click('#confirm-scale-btn')
    const scaleInput = page.locator('[data-testid="scale-cm-input"]')
    await scaleInput.clear()
    await scaleInput.fill('10')
    await page.click('[data-testid="confirm-scale-value-btn"]')

    const initialScaleValue = await page.evaluate(() => (window as any).scaleValue)
    const initialScaleLine = await page.evaluate(() => (window as any).scaleLine)
    expect(initialScaleValue?.pxPerCm).toBeGreaterThan(0)
    expect(initialScaleLine).toBeTruthy()

    await electronApp.close()

    // Second run: verify scale is restored
    ;({ app: electronApp, page } = await launchApp())

    await stubDialog(electronApp, 'showOpenDialog', {
      canceled: false,
      filePaths: [testDir]
    })
    await page.click('[data-testid="open-folder"]')
    await page.waitForSelector('#image-grid', { state: 'visible', timeout: 10000 })

    await page.click('.image-thumbnail:first-child')
    await page.waitForSelector('#image-viewer', { state: 'visible', timeout: 5000 })

    const scaleDisplay = page.locator('[data-testid="scale-display"]')
    await expect(scaleDisplay).toBeVisible()

    const restoredScaleValue = await page.evaluate(() => (window as any).scaleValue)
    const restoredScaleLine = await page.evaluate(() => (window as any).scaleLine)

    expect(restoredScaleValue?.pxPerCm).toBeCloseTo(initialScaleValue.pxPerCm, 5)
    expect(restoredScaleValue?.cmValue).toBe(initialScaleValue.cmValue)
    expect(restoredScaleLine?.start).toEqual(initialScaleLine.start)
    expect(restoredScaleLine?.end).toEqual(initialScaleLine.end)

    await page.screenshot({ path: resolve(__dirname, '../../screenshots/2.3.png') })

    await electronApp.close()
  })
})

