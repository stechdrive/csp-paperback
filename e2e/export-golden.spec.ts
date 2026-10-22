import { readFile, readdir } from 'node:fs/promises'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { unzipSync } from 'fflate'
import { expect, test } from './fixtures'
import { compareGoldenPixels } from '../src/test/helpers/compare-golden-pixels'

async function decodePng(bytes: Uint8Array) {
  const image = await loadImage(Buffer.from(bytes))
  const canvas = createCanvas(image.width, image.height)
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0)
  return { width: image.width, height: image.height,
    pixels: context.getImageData(0, 0, image.width, image.height).data }
}

const inputs = [
  { name: 'CLIP', files: ['public/sample/c001.clip'] },
  { name: 'CLIP + PSD', files: ['public/sample/c001.clip', 'testdata/c001.psd'] },
  { name: 'PSD + XDTS', files: ['testdata/c001.psd', 'testdata/c001.xdts'] },
  { name: 'sample + virtual cel', files: [] },
]

for (const input of inputs) test(`${input.name}: exported PNGs match the reference names and pixels`, async ({ page }, info) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined })
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined })
  })
  await page.goto('./')
  if (input.files.length) await page.locator('input[type=file][multiple]').setInputFiles(input.files)
  else await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()

  const expectedNames = (await readdir('testdata/golden'))
    .filter(name => name.endsWith('.png') && (!input.files.length || name !== '仮想セルテスト.png')).sort()
  // Fail if fixtures are missing, instead of making an empty comparison pass.
  expect(expectedNames).toHaveLength(input.files.length ? 8 : 9)
  await expect(page.getByRole('listbox', { name: '出力ファイル' }).getByRole('option')).toHaveCount(expectedNames.length)
  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  const settings = page.getByRole('dialog', { name: '書き出し設定', exact: true })
  await settings.getByRole('button', { name: 'PNG', exact: true }).click()
  await settings.getByRole('button', { name: '透明（PNG のみ）', exact: true }).click()
  await settings.getByRole('switch', { name: '修正ラベル', exact: true }).uncheck()
  await settings.getByRole('button', { name: '連番（シート合わせ）', exact: true }).click()
  await settings.getByRole('button', { name: '4桁', exact: true }).click()
  await settings.getByRole('switch', { name: 'フォルダ分け', exact: true }).uncheck()
  await page.mouse.move(0, 0)
  await page.keyboard.press('Escape')
  await expect(settings).toBeHidden()

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: '出力', exact: true }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('c001.zip')
  const files = unzipSync(await readFile((await download.path())!))
  expect(Object.keys(files).sort()).toEqual(expectedNames)

  for (const name of expectedNames) {
    const referenceBytes = await readFile(`testdata/golden/${name}`)
    const actualBytes = files[name]
    expect([...actualBytes.subarray(0, 8)], `${name}: PNG signature`).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    const expected = await decodePng(referenceBytes), actual = await decodePng(actualBytes)
    const dimensionsMatch = actual.width === expected.width && actual.height === expected.height
    const diff = dimensionsMatch ? compareGoldenPixels(expected.pixels, actual.pixels) : null
    if (!dimensionsMatch || diff!.overTolerancePixels) {
      await info.attach(`expected-${name}`, { body: referenceBytes, contentType: 'image/png' })
      await info.attach(`actual-${name}`, { body: Buffer.from(actualBytes), contentType: 'image/png' })
    }
    expect({ width: actual.width, height: actual.height }, name).toEqual({ width: expected.width, height: expected.height })
    expect(diff!.overTolerancePixels, `${name}: ${JSON.stringify(diff)}`).toBe(0)
  }
})
