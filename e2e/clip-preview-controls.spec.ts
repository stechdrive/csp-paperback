import { expect, test, type Page } from '@playwright/test'
import { clipPreviewFixture } from './helpers/clip-preview-fixture'

async function previewBounds(page: Page) {
  return page.evaluate(() => {
    const bounds = (selector: string) => {
      const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect()
      return { x, y, width, height }
    }
    return {
      navigator: bounds('[class*="_navigatorViewport_"]'),
      output: bounds('[class*="_outputSection_"]'),
    }
  })
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
      await expect(page.getByText('c001.clip', { exact: true })).toBeAttached({ timeout: 30000 })
      const sharedCut = page.getByRole('switch', { name: '兼用カット', exact: true, includeHidden: true })
      await expect(sharedCut).toBeChecked()
      if (!device.touch) await sharedCut.uncheck()
      const trigger = page.getByRole('button', { name: /^再現状況 \d+件/ })
      const timeline = page.getByRole('combobox', { name: 'タイムライン', exact: true })
      const popup = page.getByRole('dialog', { name: /^再現状況/ })
      await expect(trigger).toBeVisible()
      await expect(timeline).toHaveValue('1')
      await expect(page.getByText('CLIPから読み込み', { exact: true })).toHaveCount(0)
      await page.evaluate(() => document.fonts.ready)
      const before = await previewBounds(page)
      expect(before.navigator.height).toBeGreaterThan(50)
      expect(before.output.height).toBeGreaterThan(50)

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
      const heading = page.locator('[class*="_loadedHeader_"]').getByText('プレビュー', { exact: true })
      if (device.touch) await heading.tap()
      else await heading.click()
      await expect(popup).toHaveCount(0)

      // The selector uses the parsed CLIP timelines, including their distinct durations.
      const seekTrack = page.locator('[class*="_seekTrack_"]')
      const seekBounds = (await seekTrack.boundingBox())!
      await seekTrack.click({ position: { x: seekBounds.width - 1, y: seekBounds.height / 2 } })
      await expect(page.getByText('0秒6コマ', { exact: true })).toBeVisible()
      await trigger.click()
      await timeline.selectOption('2')
      await expect(popup).toHaveCount(0)
      await expect(timeline).toHaveValue('2')
      await expect(sharedCut).toHaveJSProperty('checked', device.touch)
      await expect(page.getByText('0秒1コマ', { exact: true })).toBeVisible()
      await seekTrack.click({ position: { x: seekBounds.width - 1, y: seekBounds.height / 2 } })
      await expect(page.getByText('0秒12コマ', { exact: true })).toBeVisible()
      // Compare the same populated frame; an empty frame has no output filename chips.
      await seekTrack.click({ position: { x: 1, y: seekBounds.height / 2 } })
      await expect(page.getByText('0秒1コマ', { exact: true })).toBeVisible()
      expect(await previewBounds(page)).toEqual(before)

      // Replacing the raster source removes these raster diagnostics and any open list.
      await trigger.click()
      await page.locator('input[type=file][multiple]').setInputFiles('testdata/c001.psd')
      await expect(page.getByText('c001.psd', { exact: true })).toBeAttached()
      await expect(sharedCut).toHaveJSProperty('checked', device.touch)
      await expect(trigger).toHaveCount(0)
      await expect(popup).toHaveCount(0)
      await expect(timeline).toHaveValue('2')
      // The existing toolbar notification lasts five seconds and can wrap on a phone.
      await expect(page.getByText('PSDの画像に切り替えました', { exact: true })).toHaveCount(0, { timeout: 10000 })
      expect(await previewBounds(page)).toEqual(before)

      await testInfo.attach('preview-bounds.json', { body: JSON.stringify({ before, opened, closed }, null, 2), contentType: 'application/json' })
      expect(errors).toEqual([])
    })
  })
}
