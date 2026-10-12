import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { clipVectorFixture } from './helpers/clip-vector-fixture'

test('explicitly identified 3D without cached pixels is warned separately from vectors', async ({ page }) => {
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'c001.clip', mimeType: 'application/octet-stream', buffer: await clipVectorFixture('3d') })
  const warning = page.locator('[class*="_fileNames_"]').getByRole('button', { name: '3D描画の制限' }).first()
  await expect(warning).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('button', { name: 'ベクター描画の制限' })).toHaveCount(0)
  await warning.hover()
  await expect(page.getByRole('tooltip')).toContainText('出力に含まれません')
  await page.locator('input[type=file][multiple]').setInputFiles('testdata/c001.psd')
  await expect(page.getByRole('button', { name: '3D描画の制限' })).toHaveCount(0)
})

for (const touch of [false, true]) test.describe(touch ? 'touch' : 'desktop', () => {
  test.use({ viewport: touch ? { width: 700, height: 900 } : { width: 1440, height: 1000 }, hasTouch: touch, isMobile: touch })
  test('vector warnings explain export limitations without changing preview size and disappear after PSD pairing', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined })
      Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined })
    })
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
    await page.goto('./')
    await page.locator('input[type=file][multiple]').setInputFiles({ name: 'c001.clip', mimeType: 'application/octet-stream', buffer: await clipVectorFixture() })
    await expect(page.getByText('c001.clip', { exact: true })).toBeAttached({ timeout: 30000 })
    const names = page.locator('[class*="_fileNames_"]')
    const warning = names.getByRole('button', { name: 'ベクター描画の制限' }).first()
    await expect(warning).toBeVisible()
    const output = page.locator('[class*="_outputSection_"]'), before = await output.boundingBox()
    if (touch) await warning.tap(); else await warning.hover()
    const tip = page.getByRole('tooltip').filter({ hasText: 'ベクターレイヤー' })
    await expect(tip).toBeVisible()
    await expect(tip).toContainText('クリスタで書き出したPSDを追加')
    expect(await output.boundingBox()).toEqual(before)
    const bounds = (await tip.boundingBox())!, viewport = page.viewportSize()!
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('vector-warning.png') })
    await page.keyboard.press('Escape'); await expect(tip).toHaveCount(0)
    if (!touch) {
      await warning.focus(); await expect(tip).toBeVisible()
      await page.keyboard.press('Escape'); await expect(tip).toHaveCount(0)
      await expect(page.locator('[data-layer-id]').getByRole('button', { name: 'ベクター描画の制限' }).first()).toBeVisible()
      const download = page.waitForEvent('download')
      await page.getByRole('button', { name: '出力', exact: true }).click()
      const result = await download, bytes = await readFile((await result.path())!)
      expect(bytes.subarray(0, 2).toString()).toBe('PK')
    }
    await page.locator('input[type=file][multiple]').setInputFiles('testdata/c001.psd')
    await expect(page.getByText('c001.psd', { exact: true })).toBeAttached()
    await expect(page.getByRole('button', { name: 'ベクター描画の制限', includeHidden: true })).toHaveCount(0)
    expect(errors).toEqual([])
  })
})
