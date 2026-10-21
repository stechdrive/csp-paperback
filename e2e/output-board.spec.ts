import { expect, test, type Page } from '@playwright/test'
import { manyOutputs } from './helpers/many-outputs'

const board = (page: Page) => page.getByTestId('tiled-preview')
async function load(page: Page, count = 24) {
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles(manyOutputs(count))
  await expect(board(page)).toHaveAttribute('data-count', String(count))
  await expect(board(page)).toHaveAttribute('aria-busy', 'false', { timeout: 60000 })
}
async function point(page: Page, index = 0) {
  return board(page).evaluate((element, index) => {
    const layout = JSON.parse(element.dataset.layout!), camera = JSON.parse(element.dataset.camera!), rect = element.getBoundingClientRect()
    return { x: rect.x + camera.x + (index % layout.columns * layout.stepX + layout.tileWidth / 2) * camera.zoom,
      y: rect.y + camera.y + (Math.floor(index / layout.columns) * layout.stepY + layout.tileHeight / 2) * camera.zoom }
  }, index)
}

test('default tiles preserve placement, anchored zoom and selection through single-image round trips', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await load(page)
  await expect(page.getByRole('button', { name: 'タイル表示', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(board(page).locator('canvas')).toHaveCount(2)
  const columns = await board(page).getAttribute('data-columns'), initial = Number(await board(page).getAttribute('data-zoom'))
  const p = await point(page, 8)
  await page.mouse.move(p.x, p.y); await page.mouse.wheel(0, -320)
  await expect.poll(async () => Number(await board(page).getAttribute('data-zoom'))).toBeGreaterThan(initial)
  const anchored = await point(page, 8)
  expect(anchored.x).toBeCloseTo(p.x, 0); expect(anchored.y).toBeCloseTo(p.y, 0)
  await expect(board(page)).toHaveAttribute('data-columns', columns!)
  const camera = await board(page).getAttribute('data-camera')
  await page.mouse.dblclick(p.x, p.y)
  await expect(page.getByRole('button', { name: '１点表示', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('output-view').locator('canvas')).toHaveCount(1)
  const single = page.getByLabel('１点表示の画像', { exact: true })
  await single.hover(); await page.mouse.wheel(0, -160)
  const transform = await single.locator(':scope > div').first().getAttribute('style')
  await single.dblclick()
  await expect(board(page)).toHaveAttribute('data-camera', camera!)
  await page.getByRole('button', { name: '１点表示', exact: true }).click()
  await expect(single.locator(':scope > div').first()).toHaveAttribute('style', transform!)
  await page.getByRole('button', { name: 'タイル表示', exact: true }).click()
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 40, p.y + 30, { steps: 4 })
  await expect(board(page)).toHaveCSS('cursor', 'grabbing'); await page.mouse.up()
  await expect(board(page)).not.toHaveAttribute('data-camera', camera!)
  await page.setViewportSize({ width: 1000, height: 700 })
  await expect(board(page)).toHaveAttribute('data-columns', columns!)
  await board(page).getByRole('button', { name: '画面に収める' }).click()
  await page.screenshot({ path: info.outputPath('fixed-board.png') })
  expect(errors).toEqual([])
})

test('1200 outputs remain accessible with bounded resident pixels and two display canvases', async ({ page }, info) => {
  test.setTimeout(90000)
  await load(page, 1200)
  await expect(board(page).locator('canvas')).toHaveCount(2)
  const edge = Number(await board(page).getAttribute('data-resolution'))
  await board(page).press('Control+a')
  await expect(board(page)).toHaveAttribute('data-selected-count', '1200')
  await expect(board(page).locator('canvas')).toHaveCount(2)
  expect(edge * edge * 4 * 1200).toBeLessThanOrEqual(16 * 1024 * 1024)
  expect(Number(await board(page).getAttribute('data-texture-bytes'))).toBeLessThanOrEqual(32 * 1024 * 1024)
  const list = page.getByRole('listbox', { name: '出力ファイル', exact: true })
  await list.press('End')
  await expect(list.locator('[data-active-output=true]')).toHaveAttribute('aria-posinset', '1200')
  await page.getByRole('button', { name: '出力ファイル名を検索', exact: true }).click()
  await page.getByRole('searchbox').fill('A_1199')
  await expect(board(page)).toHaveAttribute('data-count', '1')
  await page.getByRole('button', { name: '検索を解除して閉じる' }).click()
  await expect(board(page)).toHaveAttribute('data-count', '1200')
  await expect(board(page)).toHaveAttribute('aria-busy', 'false')
  await page.screenshot({ path: info.outputPath('1200-outputs.png') })
})

test('single view chooses the first result after clearing selection and after filtering', async ({ page }) => {
  await load(page)
  const single = page.getByLabel('１点表示の画像', { exact: true })
  await page.getByRole('button', { name: '１点表示', exact: true }).click()
  await expect(single.locator('canvas')).toHaveAttribute('aria-label', 'A_1.jpg')
  await page.getByRole('button', { name: 'タイル表示', exact: true }).click()
  const p = await point(page, 5); await page.mouse.click(p.x, p.y)
  await page.getByRole('button', { name: '出力一覧のメニュー', exact: true }).click()
  await page.getByRole('menuitem', { name: '選択を解除', exact: true }).click()
  await page.getByRole('button', { name: '１点表示', exact: true }).click()
  // PSD tree order is reversed: the first displayed row is A_24.
  await expect(single.locator('canvas')).toHaveAttribute('aria-label', 'A_24.jpg')
  await page.getByRole('button', { name: 'タイル表示', exact: true }).click()
  await page.getByRole('button', { name: '出力ファイル名を検索', exact: true }).click()
  await page.getByRole('searchbox').fill('A_23')
  await page.getByRole('button', { name: '１点表示', exact: true }).click()
  await expect(single.locator('canvas')).toHaveAttribute('aria-label', 'A_23.jpg')
})

for (const deviceScaleFactor of [1, 2]) test.describe(`pixel zoom at device scale ${deviceScaleFactor}`, () => {
  test.use({ deviceScaleFactor, viewport: { width: 1280, height: 820 } })
  test('100% means original pixels in every central view and stays stable on resize', async ({ page }) => {
    await load(page)
    await board(page).getByRole('button', { name: '100%', exact: true }).click()
    await expect(board(page).getByLabel('表示倍率', { exact: true })).toHaveText('100%')
    const tileWidth = await board(page).evaluate(el => JSON.parse(el.dataset.layout!).tileWidth * JSON.parse(el.dataset.camera!).zoom * devicePixelRatio)
    expect(tileWidth).toBeCloseTo(64, 4)
    await page.setViewportSize({ width: 1100, height: 740 })
    await expect(board(page).getByLabel('表示倍率', { exact: true })).toHaveText('100%')
    await page.getByRole('button', { name: '１点表示', exact: true }).click()
    const output = page.getByTestId('output-view'), canvas = output.locator('canvas')
    await output.getByRole('button', { name: '100%', exact: true }).click()
    await expect(output.getByLabel('表示倍率', { exact: true })).toHaveText('100%')
    expect((await canvas.boundingBox())!.width * deviceScaleFactor).toBeCloseTo(64, 4)
    await page.setViewportSize({ width: 1200, height: 800 })
    expect((await canvas.boundingBox())!.width * deviceScaleFactor).toBeCloseTo(64, 4)
    await page.getByRole('button', { name: '全体プレビュー', exact: true }).click()
    const nav = page.getByTestId('navigator-view')
    await nav.getByRole('button', { name: '100%', exact: true }).click()
    await expect(nav.getByLabel('表示倍率', { exact: true })).toHaveText('100%')
    expect((await nav.locator('canvas').boundingBox())!.width * deviceScaleFactor).toBeCloseTo(64, 4)
  })
})

test('large canvas can reach and exceed 100% without a thumbnail-relative zoom ceiling', async ({ page }) => {
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles(manyOutputs(1, 'A', 8192, 64))
  await expect(board(page)).toHaveAttribute('aria-busy', 'false')
  await board(page).getByRole('button', { name: '100%', exact: true }).click()
  await expect(board(page).getByLabel('表示倍率', { exact: true })).toHaveText('100%')
  const initial = Number(await board(page).getAttribute('data-zoom'))
  await board(page).hover(); await page.mouse.wheel(0, -160)
  await expect.poll(async () => Number(await board(page).getAttribute('data-zoom'))).toBeGreaterThan(initial)
})

test('context loss uses Canvas pixels and restores the GPU display without losing the camera', async ({ page }) => {
  await load(page)
  await expect(board(page)).toHaveAttribute('data-backend', 'webgl2')
  const camera = await board(page).getAttribute('data-camera')
  await board(page).locator('canvas').last().evaluate(canvas => {
    const gl = canvas.getContext('webgl2')!, extension = gl.getExtension('WEBGL_lose_context')!
    extension.loseContext(); setTimeout(() => extension.restoreContext(), 1000)
  })
  await expect(board(page)).toHaveAttribute('data-backend', 'canvas2d')
  await expect(board(page)).toHaveAttribute('data-backend', 'webgl2')
  await expect(board(page)).toHaveAttribute('data-camera', camera!)
})

test('Canvas fallback provides the same navigation when WebGL2 is unavailable', async ({ page }, info) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type, ...args)
    } as typeof original
  })
  await load(page)
  await expect(board(page)).toHaveAttribute('data-backend', 'canvas2d')
  const p = await point(page, 4); await page.mouse.dblclick(p.x, p.y)
  await expect(page.getByRole('button', { name: '１点表示', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('１点表示の画像', { exact: true }).dblclick()
  await page.screenshot({ path: info.outputPath('canvas-fallback.png') })
})

test.describe('touch board', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
  test('pinch, one-finger pan and double-tap round trip preserve layout', async ({ page }) => {
    await load(page)
    const columns = await board(page).getAttribute('data-columns'), initial = Number(await board(page).getAttribute('data-zoom'))
    const rect = (await board(page).boundingBox())!, x = rect.x + rect.width / 2, y = rect.y + rect.height / 2
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 20, y }, { x: x + 20, y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 70, y }, { x: x + 70, y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(async () => Number(await board(page).getAttribute('data-zoom'))).toBeGreaterThan(initial)
    await expect(board(page)).toHaveAttribute('data-columns', columns!)
    await board(page).getByRole('button', { name: '画面に収める' }).tap()
    await expect.poll(async () => Number(await board(page).getAttribute('data-zoom'))).toBeCloseTo(initial)
    const p = await point(page)
    await page.touchscreen.tap(p.x, p.y); await page.touchscreen.tap(p.x, p.y)
    await expect(page.getByLabel('１点表示の画像', { exact: true })).toBeVisible()
    const single = (await page.getByLabel('１点表示の画像', { exact: true }).boundingBox())!
    await page.touchscreen.tap(single.x + 60, single.y + 60); await page.touchscreen.tap(single.x + 60, single.y + 60)
    await expect(board(page)).toBeVisible()
    await expect(board(page)).toHaveAttribute('data-columns', columns!)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await cdp.detach()
  })
})
