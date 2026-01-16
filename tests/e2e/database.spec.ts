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
  // Create test directory and copy some test images
  testDir = mkdtempSync(join(tmpdir(), 'herbivory-e2e-'))

  // Copy at least one test image to trigger database creation
  const imageFiles = readdirSync(imagesDir).filter(f =>
    /\.(jpg|jpeg|png|heic|heif)$/i.test(f)
  ).slice(0, 2) // Just take 2 images for speed

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

test.describe('Feature 1.3: SQLite database creation', () => {
  test('open folder button is visible and enabled', async () => {
    const openFolderBtn = page.locator('[data-testid="open-folder"]')
    await expect(openFolderBtn).toBeVisible()
    await expect(openFolderBtn).toBeEnabled()
    await expect(openFolderBtn).toHaveText('Open Folder')
  })

  test('table list element exists for displaying database tables', async () => {
    // The table-list element should exist in the DOM (even if hidden initially)
    const tableList = page.locator('[data-testid="table-list"]')
    await expect(tableList).toBeAttached()
  })

  test('database is created with correct schema when folder is opened', async () => {
    // Stub the dialog to return our test directory
    await stubDialog(electronApp, 'showOpenDialog', {
      canceled: false,
      filePaths: [testDir]
    })

    // Click open folder
    await page.click('[data-testid="open-folder"]')

    // Wait for status to appear
    await page.waitForSelector('#folder-status', { state: 'visible', timeout: 5000 })

    // Verify the table list shows all required tables
    const tableList = page.locator('[data-testid="table-list"]')
    const tableText = await tableList.textContent()

    expect(tableText).toContain('images')
    expect(tableText).toContain('polygons')
    expect(tableText).toContain('cells')
    expect(tableText).toContain('app_state')

    // Verify database file was created on disk
    const dbPath = join(testDir, 'herbivory.db')
    expect(existsSync(dbPath)).toBe(true)
  })
})
