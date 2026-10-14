import { readFile, writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function expectSampleLoaded(page: Page) {
  await page.getByRole('button', { name: 'メニュー', exact: true }).click()
  await expect(page.locator('#toolbar-app-menu').getByText('c001.clip', { exact: true })).toBeVisible({ timeout: 30000 })
  await page.keyboard.press('Escape')
}

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

for (const name of ['ヘルプ', '設定']) {
  test(`アプリメニューからTabで${name}を開いてもメニューがダイアログに残らない`, async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: 'メニュー', exact: true }).click()
    const menu = page.locator('#toolbar-app-menu')
    await menu.getByRole('button', { name: '設定', exact: true }).focus()
    const action = page.locator('[class*="_utilityButtons_"]').getByRole('button', { name, exact: true })
    for (let step = 0; step < 15 && !await action.evaluate(element => document.activeElement === element); step++) {
      await page.keyboard.press('Tab')
    }
    await expect(action).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(menu).toHaveCount(0)
    if (name === 'ヘルプ') {
      const dialog = page.getByRole('dialog', { name: 'CSP Paperback ヘルプ' })
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: 'ヘルプを閉じる' }).click()
      await expect(dialog).toHaveCount(0)
    } else {
      const dialog = page.locator('[class*="_dialog_"]').filter({ has: page.getByText('書き出し詳細設定', { exact: true }) })
      await expect(dialog).toBeVisible()
      await dialog.locator('[class*="_header_"]').getByRole('button', { name: '✕', exact: true }).click()
      await expect(dialog).toHaveCount(0)
    }
  })
}

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
  await expect(startupSettings.getByLabel('出力例: A/A_1_e.png')).toBeVisible()

  await page.reload()
  const reloadedSettings = page.getByTestId('startup-export-settings')
  await expect(reloadedSettings.getByLabel('出力例: A/A_1_e.png')).toBeVisible()
  await expect(reloadedSettings.getByRole('switch', { name: 'フォルダ分け', exact: true }))
    .toHaveAttribute('aria-checked', 'true')

  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  await expectSampleLoaded(page)
  await expect(page.getByText('CLIPから読み込み', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  await expect(page.getByLabel('出力例: A/A_1_e.png')).toBeVisible()
  await page.keyboard.press('Escape')

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
    const drawerToggle = page.getByRole('button', { name: '書き出し設定', exact: true })
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
  await expect(settings.getByLabel('出力例: A_e_1.png')).toBeVisible()
  await expect(settings.locator('[data-name-part="suffix"]')).toHaveAttribute('data-highlighted', 'true')
  await settings.getByRole('button', { name: 'なし', exact: true }).click()
  await expect(settings.getByLabel('出力例: A_e1.png')).toBeVisible()
  await expect(settings.locator('[data-name-part="separator"]')).toHaveAttribute('data-highlighted', 'true')
  await settings.locator('[data-name-part="prefix"]').click()
  await expect(settings.getByRole('switch', { name: 'アニメーションフォルダ名', exact: true })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(settings.getByLabel('出力例: _e1.png')).toBeVisible()
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
  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  const revision = settings.getByRole('switch', { name: '修正ラベル', exact: true })
  await revision.uncheck()
  await expect(sample).toHaveCSS('border-top-color', 'rgb(255, 255, 255)')
  expect(await output.boundingBox()).toEqual(before)
  await revision.check()
  expect(await output.boundingBox()).toEqual(before)
  await page.keyboard.press('Escape')
  expect(await output.boundingBox()).toEqual(before)
  await page.screenshot({ path: testInfo.outputPath('loaded.png') })
})

test('工程名の編集と個別書き出しの設定を通常幅と狭幅で操作できる', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('./')
  await page.evaluate(() => document.fonts.ready)
  const startupSettingsRegion = await page.getByTestId('startup-export-settings').boundingBox()
  await page.screenshot({ path: testInfo.outputPath('help-startup-guide.png') })
  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  await expectSampleLoaded(page)
  await page.evaluate(() => document.fonts.ready)
  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  const outputSettings = page.getByRole('dialog', { name: '書き出し設定', exact: true })
  await expect(outputSettings.getByRole('button', { name: '作画', exact: true })).toBeVisible()
  await expect(outputSettings.getByRole('button', { name: 'SL 個別書き出し', exact: true })).toBeVisible()
  await page.mouse.move(0, 0)
  await page.screenshot({ path: testInfo.outputPath('help-export-settings.png') })
  const exportSettingsRegion = await outputSettings.boundingBox()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '設定', exact: true }).click()
  const dialog = page.locator('[class*="_dialog_"]').filter({ has: page.getByText('書き出し詳細設定', { exact: true }) })
  const processSection = dialog.getByTestId('process-table-grid').locator('..')
  await expect(dialog.getByLabel('グループ名 1', { exact: true })).toBeVisible()
  await expect(dialog.getByLabel('対象フォルダを非表示でも表示して読み込む', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('help-settings-dialog.png') })
  await writeFile(testInfo.outputPath('help-regions.json'), JSON.stringify({
    startupSettings: startupSettingsRegion,
    exportSettings: exportSettingsRegion,
    settingsDialog: await dialog.boundingBox(),
    processSettings: await processSection.boundingBox(),
  }, null, 2))

  for (const viewport of [{ width: 960, height: 640 }, { width: 700, height: 900 }]) {
    await page.setViewportSize(viewport)
    const name = dialog.getByLabel('グループ名 1', { exact: true })
    await name.scrollIntoViewIfNeeded()
    await expect(name).toBeVisible()
    await expect(dialog.getByLabel('対応するフォルダ名 1', { exact: true })).toBeVisible()
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(await dialog.locator('[class*="_body_"]').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`process-settings-${viewport.width}.png`) })
  }
  await dialog.getByLabel('グループ名 1', { exact: true }).fill('演出チェック')
  await dialog.locator('[class*="_header_"]').getByRole('button', { name: '✕', exact: true }).click()
  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  await expect(outputSettings.getByRole('button', { name: '演出チェック', exact: true })).toBeVisible()
})

for (const viewport of [{ width: 1440, height: 1000 }, { width: 1000, height: 700 }, { width: 700, height: 700 }]) {
  test(`説明を表示しても出力例を隠さず、画面内に収める（${viewport.width}px）`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.setViewportSize(viewport)
    await page.goto('./')
    const settings = page.getByTestId('export-settings')
    const sample = settings.getByTestId('name-sample-row')
    const targets = [
      settings.getByRole('button', { name: 'PNG', exact: true }),
      settings.getByRole('button', { name: '連番＋セル名', exact: true }),
      settings.getByRole('button', { name: 'セル名', exact: true }),
      settings.getByRole('button', { name: '連番（シート合わせ）', exact: true }),
      settings.getByText('出力名', { exact: true }),
      settings.getByRole('button', { name: '自動', exact: true }),
      settings.getByRole('switch', { name: 'アニメーションフォルダ名', exact: true }),
      settings.getByRole('button', { name: 'なし', exact: true }),
      settings.getByRole('button', { name: '前', exact: true }),
      settings.getByRole('switch', { name: 'フォルダ分け', exact: true }),
      settings.getByRole('switch', { name: '修正ラベル', exact: true }),
      settings.getByRole('switch', { name: '兼用カット', exact: true }),
      settings.getByRole('button', { name: '演出', exact: true }),
    ]
    for (const phase of ['startup', 'loaded']) {
      if (phase === 'loaded') {
        await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
        await expectSampleLoaded(page)
        const drawer = page.getByRole('button', { name: '書き出し設定', exact: true })
        await drawer.click()
      }
      await expect(settings).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      const settingsHeight = (await settings.boundingBox())!.height
      const output = page.locator('[class*="_outputSection_"]')
      const outputHeight = phase === 'loaded' ? (await output.boundingBox())!.height : null
      for (const control of targets) {
        await control.hover()
        const tooltip = page.getByRole('tooltip')
        await expect(tooltip).toBeVisible()
        const tip = (await tooltip.boundingBox())!
        const example = (await sample.boundingBox())!
        expect(tip.x + tip.width <= example.x || tip.x >= example.x + example.width
          || tip.y + tip.height <= example.y || tip.y >= example.y + example.height).toBe(true)
        expect(tip.x).toBeGreaterThanOrEqual(0)
        expect(tip.y).toBeGreaterThanOrEqual(0)
        expect(tip.x + tip.width).toBeLessThanOrEqual(viewport.width)
        expect(tip.y + tip.height).toBeLessThanOrEqual(viewport.height)
        expect((await settings.boundingBox())!.height).toBe(settingsHeight)
        if (outputHeight !== null) expect((await output.boundingBox())!.height).toBe(outputHeight)
        await page.mouse.move(0, 0)
        await expect(tooltip).toHaveCount(0)
      }
      // The browser's native title popup cannot avoid the example, so do not duplicate it.
      await expect(sample.locator('[title]')).toHaveCount(0)
      await settings.getByRole('switch', { name: 'アニメーションフォルダ名', exact: true }).hover()
      await expect(page.getByRole('tooltip')).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath(`${phase}-tooltip.png`) })
      await page.mouse.move(0, 0)
      if (phase === 'loaded') await page.keyboard.press('Escape')
    }
    expect(errors).toEqual([])
  })
}
