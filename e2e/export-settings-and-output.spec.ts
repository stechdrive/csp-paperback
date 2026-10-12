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
  await expect(startupSettings.getByTitle('A/A_1_e.png')).toBeVisible()

  await page.reload()
  const reloadedSettings = page.getByTestId('startup-export-settings')
  await expect(reloadedSettings.getByTitle('A/A_1_e.png')).toBeVisible()
  await expect(reloadedSettings.getByRole('switch', { name: 'フォルダ分け', exact: true }))
    .toHaveAttribute('aria-checked', 'true')

  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  await expect(page.getByText('c001.clip', { exact: true })).toBeVisible()
  await expect(page.getByText('CLIPから読み込み', { exact: true })).toHaveCount(0)
  await expect(page.getByTitle('A/A_1_e.png')).toBeVisible()

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
    await page.getByRole('button', { name: 'PNG', exact: true }).tap()
    await expect(page.locator('[data-name-part="extension"]')).toHaveAttribute('data-highlighted', 'true')
    await expect(page.locator('[data-name-part][data-highlighted="true"]')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true)
  })
})

test('設定と出力名の対応を示し、修正ラベルの切り替えでプレビューの高さを変えない', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('./')
  const settings = page.getByTestId('export-settings')
  await expect(settings).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const initialHeight = (await settings.boundingBox())!.height
  await expect(settings.locator('[data-highlighted="true"]')).toHaveCount(0)
  await settings.getByRole('button', { name: 'PNG', exact: true }).click()
  await expect(settings.locator('[data-name-part="extension"]')).toHaveAttribute('data-highlighted', 'true')
  await page.mouse.move(0, 0)
  await expect(settings.locator('[data-highlighted="true"]')).toHaveCount(0)
  await settings.getByRole('button', { name: '前', exact: true }).hover()
  const suffixPart = settings.locator('[data-name-part="suffix"]')
  await expect(suffixPart).toHaveAttribute('data-highlighted', 'true')
  await expect(suffixPart).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(suffixPart).toHaveCSS('box-shadow', 'none')
  await expect(suffixPart).toHaveCSS('text-decoration-line', 'underline')
  expect(await suffixPart.evaluate(el => getComputedStyle(el).color === getComputedStyle(el.previousElementSibling!).color)).toBe(true)
  await page.mouse.move(0, 0)
  await expect(settings.locator('[data-highlighted="true"]')).toHaveCount(0)
  await settings.getByRole('button', { name: '前', exact: true }).click()
  await expect(settings.getByTitle('A_e_1.png')).toBeVisible()
  await expect(settings.locator('[data-name-part="suffix"]')).toHaveAttribute('data-highlighted', 'true')
  await settings.getByRole('button', { name: 'なし', exact: true }).click()
  await expect(settings.getByTitle('A_e1.png')).toBeVisible()
  await expect(settings.locator('[data-name-part="separator"]')).toHaveAttribute('data-highlighted', 'true')
  await settings.locator('[data-name-part="prefix"]').click()
  await expect(settings.getByRole('switch', { name: 'アニメーションフォルダ名', exact: true })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(settings.getByTitle('_e1.png')).toBeVisible()
  await page.mouse.move(0, 0)
  await page.keyboard.press('Tab')
  await expect(settings.getByRole('button', { name: '_ あり', exact: true })).toBeFocused()
  await expect(settings.locator('[data-name-part="separator"]')).toHaveAttribute('data-highlighted', 'true')
  await page.keyboard.press('Escape')
  await expect(settings.locator('[data-highlighted="true"]')).toHaveCount(0)
  expect((await settings.boundingBox())!.height).toBe(initialHeight)
  const sample = settings.getByTestId('revision-label-sample')
  const size = await sample.boundingBox()
  expect(size!.width / size!.height).toBeCloseTo(16 / 9)
  await expect(sample).toHaveCSS('border-top-width', '5px')
  await expect(sample).toHaveCSS('border-top-color', 'rgb(252, 249, 207)')
  await settings.screenshot({ path: testInfo.outputPath('export-settings.png') })
  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  const output = page.locator('[class*="_outputSection_"]')
  await expect(output).toBeVisible()
  const before = await output.boundingBox()
  const revision = settings.getByRole('switch', { name: '修正ラベル', exact: true })
  await revision.uncheck()
  await expect(sample).toHaveCSS('border-top-color', 'rgb(255, 255, 255)')
  expect(await output.boundingBox()).toEqual(before)
  await revision.check()
  expect(await output.boundingBox()).toEqual(before)
  await page.screenshot({ path: testInfo.outputPath('loaded.png') })
})
