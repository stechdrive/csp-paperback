import { expect, test, type Page } from './fixtures'
import { clipPreviewFixture } from './helpers/clip-preview-fixture'

async function previewBounds(page: Page) {
  return page.evaluate(() => {
    const bounds = (selector: string) => {
      const visible = [...document.querySelectorAll(selector)].map(element => element.getBoundingClientRect()).find(rect => rect.width > 0 && rect.height > 0)
      if (!visible) return null
      const { x, y, width, height } = visible
      return { x, y, width, height }
    }
    return {
      main: bounds('[data-testid="main-preview"]'),
      navigator: bounds('[class*="_navigatorViewport_"]'),
      output: bounds('[class*="_outputSection_"]'),
    }
  })
}

async function expectLoadedFile(page: Page, file: string) {
  await page.getByRole('button', { name: 'メニュー', exact: true }).click()
  await expect(page.locator('#toolbar-app-menu').getByText(file, { exact: true })).toBeVisible({ timeout: 30000 })
  await page.keyboard.press('Escape')
}

async function expectSharedCut(page: Page, checked: boolean) {
  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  await expect(page.getByRole('switch', { name: '兼用カット', exact: true })).toHaveJSProperty('checked', checked)
  await page.keyboard.press('Escape')
}

for (const device of [
  { name: 'desktop', width: 1440, height: 1000, touch: false },
  { name: 'tablet', width: 700, height: 900, touch: true },
  { name: 'phone', width: 390, height: 844, touch: true },
]) {
  test.describe(device.name, () => {
    test.use({ viewport: { width: device.width, height: device.height }, hasTouch: device.touch, isMobile: device.touch })

    test('再現状況の開閉・スクロールでプレビューの高さが変わらず、タイムラインを切り替えられる', async ({ page }, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto('./')
      await page.locator('input[type=file][multiple]').setInputFiles({
        name: 'c001.clip', mimeType: 'application/octet-stream', buffer: await clipPreviewFixture(),
      })
      await expectLoadedFile(page, 'c001.clip')
      await page.getByRole('button', { name: 'キャンバス', exact: true }).click()
      await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
      const sharedCut = page.getByRole('switch', { name: '兼用カット', exact: true })
      await expect(sharedCut).toBeChecked()
      if (!device.touch) await sharedCut.uncheck()
      await page.keyboard.press('Escape')
      const trigger = page.getByRole('button', { name: /^再現状況 \d+件/ })
      const timeline = page.getByRole('combobox', { name: 'タイムライン', exact: true })
      const popup = page.getByRole('dialog', { name: /^再現状況/ })
      await expect(trigger).toBeVisible()
      await expect(page.locator('[aria-label="プレビューと出力の操作"]').getByRole('button', { name: /^再現状況/ })).toBeVisible()
      await expect(page.getByTestId('navigator-panel').getByRole('button', { name: /^再現状況/ })).toHaveCount(0)
      await expect(timeline).toHaveValue('1')
      await expect(page.getByText('CLIPから読み込み', { exact: true })).toHaveCount(0)
      await page.evaluate(() => document.fonts.ready)
      const before = await previewBounds(page)
      expect(before.main!.height).toBeGreaterThan(50)
      expect(before.output).toBeNull()
      expect(before.navigator!.height).toBeGreaterThan(50)

      await trigger.click()
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')
      await expect(popup).toBeVisible()
      const opened = await previewBounds(page)
      expect(opened).toEqual(before)
      const list = popup.getByRole('list', { name: '再現状況の一覧' })
      expect(await list.locator('li').count()).toBeGreaterThan(10)
      expect(await list.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
      await list.focus()
      await page.keyboard.press('End')
      await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
      expect(await previewBounds(page)).toEqual(before)
      const popupBounds = (await popup.boundingBox())!
      expect(popupBounds.x).toBeGreaterThanOrEqual(0)
      expect(popupBounds.x + popupBounds.width).toBeLessThanOrEqual(device.width)
      expect(popupBounds.y + popupBounds.height).toBeLessThanOrEqual(device.height)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath('diagnostics-open.png') })

      await page.keyboard.press('Escape')
      await expect(popup).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
      const closed = await previewBounds(page)
      expect(closed).toEqual(before)

      await trigger.click()
      await popup.getByRole('button', { name: '再現状況を閉じる' }).click()
      await expect(trigger).toBeFocused()
      await trigger.click()
      // On touch layouts the toolbar popover can cover the preview-mode buttons.
      if (device.touch) {
        const whole = page.getByTestId('navigator-view')
        await whole.tap({ position: { x: 10, y: (await whole.boundingBox())!.height - 60 } })
        await expect(popup).toHaveCount(0)
      }
      const heading = page.getByRole('button', { name: '書き出し画像', exact: true })
      if (device.touch) await heading.tap()
      else await heading.click()
      await expect(popup).toHaveCount(0)

      // The selector uses the parsed CLIP timelines, including their distinct durations.
      await page.getByRole('button', { name: 'キャンバス', exact: true }).click()
      const timelineBounds = await previewBounds(page)
      expect(timelineBounds.navigator!.height).toBeGreaterThan(50)
      // The navigator is also mounted in the hidden mobile layer panel.
      const seekTrack = page.getByRole('slider', { name: 'タイムラインのフレーム', exact: true })
      const seekLabel = page.locator('[class*="_seekLabel_"]:visible')
      const seekBounds = (await seekTrack.boundingBox())!
      await seekTrack.click({ position: { x: seekBounds.width - 1, y: seekBounds.height / 2 } })
      await expect(seekLabel).toHaveText('0秒6コマ')
      await trigger.click()
      await timeline.selectOption('2')
      await expect(popup).toHaveCount(0)
      await expect(timeline).toHaveValue('2')
      await expectSharedCut(page, device.touch)
      await expect(seekLabel).toHaveText('0秒1コマ')
      await seekTrack.click({ position: { x: seekBounds.width - 1, y: seekBounds.height / 2 } })
      await expect(seekLabel).toHaveText('0秒12コマ')
      // Compare the same populated frame after switching timelines.
      await seekTrack.click({ position: { x: 1, y: seekBounds.height / 2 } })
      await expect(seekLabel).toHaveText('0秒1コマ')
      expect(await previewBounds(page)).toEqual(timelineBounds)

      // The large navigator keeps its bounds while the same diagnostics are open.
      await trigger.click()
      expect(await previewBounds(page)).toEqual(timelineBounds)
      await page.keyboard.press('Escape')

      // Replacing the raster source removes these raster diagnostics and any open list.
      await trigger.click()
      await page.locator('input[type=file][multiple]').setInputFiles('testdata/c001.psd')
      await expect(trigger).toHaveCount(0)
      await expect(popup).toHaveCount(0)
      await expectLoadedFile(page, 'c001.psd')
      await expectSharedCut(page, device.touch)
      await expect(timeline).toHaveValue('2')
      // The toolbar stays on one row even while the source-change notification is visible.
      expect(await previewBounds(page)).toEqual(timelineBounds)

      await testInfo.attach('preview-bounds.json', { body: JSON.stringify({ before, opened, closed }, null, 2), contentType: 'application/json' })
      expect(errors).toEqual([])
    })
  })
}
