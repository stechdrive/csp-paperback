import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: undefined,
    })
  })
})

test('保存設定を再読込とサンプル読込へ引き継ぎ、実ZIPを書き出す', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') pageErrors.push(message.text())
  })

  await page.goto('./')
  const startupSettings = page.getByTestId('startup-export-settings')
  await expect(startupSettings).toBeVisible()
  await expect(page.getByRole('link', {
    name: 'デスクトップ版をダウンロード',
    exact: true,
  })).toHaveAttribute('href', 'https://github.com/stechdrive/csp-paperback/releases')

  await startupSettings.getByRole('button', { name: 'PNG', exact: true }).click()
  await startupSettings.getByRole('switch', { name: 'フォルダ分け', exact: true }).click()
  await expect(startupSettings.getByTitle('A/A1_e.png')).toBeVisible()

  await page.reload()
  const reloadedSettings = page.getByTestId('startup-export-settings')
  await expect(reloadedSettings.getByTitle('A/A1_e.png')).toBeVisible()
  await expect(reloadedSettings.getByRole('switch', { name: 'フォルダ分け', exact: true }))
    .toHaveAttribute('aria-checked', 'true')

  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  await expect(page.getByText('c001.psd', { exact: true })).toBeVisible()
  await expect(page.getByText('c001.xdts', { exact: true })).toBeVisible()
  await expect(page.getByTitle('A/A1_e.png')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '出力', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('c001.zip')
  const downloadPath = await download.path()
  expect(downloadPath).not.toBeNull()
  const zip = await readFile(downloadPath!)
  expect([...zip.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
  expect(zip.byteLength).toBeGreaterThan(100)
  expect(pageErrors).toEqual([])
})

test.describe('タッチ端末', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 700, height: 900 },
  })

  test('狭幅でも起動画面と読み込み後の設定UIが横にはみ出さない', async ({ page }) => {
    await page.goto('./')

    await expect(page.getByTestId('startup-export-settings')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true)

    await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
    const drawerToggle = page.getByRole('button', { name: /書き出し設定/ })
    await expect(drawerToggle).toBeVisible()
    await expect(drawerToggle).toHaveAttribute('aria-expanded', 'false')
    await drawerToggle.click()
    await expect(drawerToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('button', { name: 'PNG', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true)
  })
})
