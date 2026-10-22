import { expect, test, type Locator, type Page } from './fixtures'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { pixelOutput } from './helpers/pixel-output'

async function doubleZoom(target: Locator) {
  await target.evaluate(element => {
    const rect = element.getBoundingClientRect()
    for (let i = 0; i < 3; i++) element.dispatchEvent(new WheelEvent('wheel', { deltaY: -Math.log(2) / .006,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, bubbles: true, cancelable: true }))
  })
}
async function assertPixelBlocks(page: Page, target: Locator, ratio: number, block: number, translucent = false) {
  const box = (await target.boundingBox())!
  const buffer = await page.screenshot({ clip: { x: box.x + box.width / 2 - 32 / ratio, y: box.y + box.height / 2 - 32 / ratio,
    width: 64 / ratio, height: 64 / ratio }, scale: 'device' })
  const image = await loadImage(buffer), canvas = createCanvas(image.width, image.height), ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, image.width, image.height).data
  const colors = new Set<number>()
  let colored = 0
  for (let i = 0; i < pixels.length; i += 4) {
    colors.add(pixels[i]); if (pixels[i + 1] !== pixels[i] || pixels[i + 2] !== pixels[i]) colored++
  }
  expect(colored).toBe(0)
  // The checkerboard itself can be filtered at a fractional viewport origin.
  // Each source pixel must still be exactly black or white at 50% opacity.
  if (translucent) {
    expect([...colors].every(color => color >= 110 && color <= 127 || color >= 238 && color <= 255)).toBe(true)
    expect(colors.has(110) && colors.has(255)).toBe(true)
  } else expect([...colors].sort((a, b) => a - b)).toEqual([0, 255])
  if (!block) return
  const runs: number[] = []
  let count = 1
  for (let x = 1; x < image.width; x++) {
    if (pixels[x * 4] === pixels[(x - 1) * 4]) count++
    else { runs.push(count); count = 1 }
  }
  expect(runs.slice(1).every(length => length === block)).toBe(true)
}

for (const canvas2d of [false, true]) test(`translucent native windows replace the overview without dark seams (${canvas2d ? 'Canvas2D' : 'WebGL2'})`, async ({ page }) => {
  test.setTimeout(90000)
  if (canvas2d) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      return type === 'webgl2' ? null : original.call(this, type, ...args)
    } as typeof original
  })
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles(pixelOutput(4096, 2048, 128))
  const board = page.getByTestId('tiled-preview')
  await expect(board).toHaveAttribute('data-count', '1')
  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  const settings = page.getByRole('dialog', { name: '書き出し設定', exact: true })
  await settings.getByRole('button', { name: 'PNG', exact: true }).click()
  await settings.getByRole('button', { name: '透明（PNG のみ）', exact: true }).click()
  await page.keyboard.press('Escape')
  for (const mode of ['tiles', 'single']) {
    if (mode === 'single') await page.getByRole('button', { name: '１点表示', exact: true }).click()
    const target = mode === 'tiles' ? board : page.getByLabel('１点表示の画像', { exact: true })
    const surface = mode === 'tiles' ? board : page.getByTestId('single-preview-surface')
    const tools = mode === 'tiles' ? board : page.getByTestId('output-view')
    await tools.getByRole('button', { name: '100%', exact: true }).click()
    await expect(surface).toHaveAttribute('aria-busy', 'false', { timeout: 60000 })
    await assertPixelBlocks(page, target, 1, 0, true)
  }
})

for (const { ratio, canvas2d } of [{ ratio: 1 }, { ratio: 1.25 }, { ratio: 2 }, { ratio: 3 }, { ratio: 1, canvas2d: true }]) {
  test.describe(`native pixels DPR=${ratio} ${canvas2d ? 'Canvas2D' : 'WebGL2'}`, () => {
    test.use({ deviceScaleFactor: ratio, viewport: { width: 1280, height: 820 } })
    test('board and single view preserve original pixels at 100%, 200%, 400% with bounded surfaces', async ({ page }) => {
      test.setTimeout(90000)
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
      if (canvas2d) await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext
        HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
          return type === 'webgl2' ? null : original.call(this, type, ...args)
        } as typeof original
      })
      await page.goto('./')
      await page.locator('input[type=file][multiple]').setInputFiles(pixelOutput())
      const board = page.getByTestId('tiled-preview')
      await expect(board).toHaveAttribute('data-count', '1')
      await expect(board).toHaveAttribute('aria-busy', 'false', { timeout: 60000 })
      for (const mode of ['tiles', 'single']) {
        if (mode === 'single') await page.getByRole('button', { name: '１点表示', exact: true }).click()
        const target = mode === 'tiles' ? board : page.getByLabel('１点表示の画像', { exact: true })
        const surface = mode === 'tiles' ? board : page.getByTestId('single-preview-surface')
        const tools = mode === 'tiles' ? board : page.getByTestId('output-view')
        await tools.getByRole('button', { name: '100%', exact: true }).click()
        for (const block of [1, 2, 4]) {
          if (block > 1) await doubleZoom(target)
          await expect(tools.getByLabel('表示倍率', { exact: true })).toHaveText(`${block * 100}%`)
          await expect(surface).toHaveAttribute('aria-busy', 'false', { timeout: 60000 })
          await assertPixelBlocks(page, target, ratio, block)
        }
        expect(Number(await surface.getAttribute('data-texture-bytes'))).toBeLessThanOrEqual(32 * 1024 * 1024)
        expect(Number(await surface.getAttribute('data-cache-bytes'))).toBeLessThanOrEqual(112 * 1024 * 1024)
        const dimensions = await surface.locator('canvas').evaluateAll((canvases: HTMLCanvasElement[]) => canvases.map(c => ({
          width: c.width, height: c.height, screenWidth: c.clientWidth * devicePixelRatio, screenHeight: c.clientHeight * devicePixelRatio,
        })))
        for (const d of dimensions) { expect(d.width).toBeLessThanOrEqual(Math.ceil(d.screenWidth)); expect(d.height).toBeLessThanOrEqual(Math.ceil(d.screenHeight)) }
      }
      expect(errors).toEqual([])
    })
  })
}
