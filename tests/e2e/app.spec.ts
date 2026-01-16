import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { resolve } from 'path'

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  electronApp = await electron.launch({
    args: [resolve(__dirname, '../../dist/main/index.js')]
  })
  page = await electronApp.firstWindow()
})

test.afterAll(async () => {
  await electronApp.close()
})

test('app window opens with correct title', async () => {
  const title = await page.title()
  expect(title).toBe('Herbivory Counter')
})

test('app window has no console errors on startup', async () => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  // Wait a moment for any errors to appear
  await page.waitForTimeout(1000)

  expect(errors).toHaveLength(0)
})
