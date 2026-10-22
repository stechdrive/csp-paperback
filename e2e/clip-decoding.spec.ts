import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'
import { expect, test } from './fixtures'
import { clipDecodingFixture } from './helpers/clip-decoding'

for (const kind of ['raster', 'vector'] as const) test(`疎な${kind}素材をWorkerで復元し、全出力と文書切り替えを保つ`, async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined })
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined })
  })
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles({ name: `${kind}.clip`, mimeType: 'application/octet-stream',
    buffer: await clipDecodingFixture(kind, 768, 512, 3) })
  await expect(page.getByText('3件', { exact: true })).toBeVisible()
  const list = page.getByRole('listbox', { name: '出力ファイル' })
  const prefix = kind === 'raster' ? '_R' : '_V'
  const row = list.getByRole('option', { name: `${prefix}_002.jpg`, exact: true })
  await row.click()
  await expect(row.locator('canvas')).toHaveAttribute('data-ready', 'true')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '出力', exact: true }).click()
  const files = unzipSync(await readFile((await (await download).path())!))
  expect(Object.keys(files).sort()).toEqual([1, 2, 3].map(n => `${prefix}_${String(n).padStart(3, '0')}.jpg`))
  for (const bytes of Object.values(files)) expect(bytes.length).toBeGreaterThan(1000)
  await page.locator('input[type=file][multiple]').setInputFiles('public/sample/c001.clip')
  // File import has eight outputs; the sample button adds a ninth virtual cel.
  await expect(page.getByText('8件', { exact: true })).toBeVisible()
  await expect(list.getByRole('option', { name: `${prefix}_002.jpg`, exact: true })).toHaveCount(0)
  expect(errors).toEqual([])
})
