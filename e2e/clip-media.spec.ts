import { expect, test } from './fixtures'
import { clipMediaFixture } from '../src/test/fixtures/clip-media'

test('音声と映像を識別し、出力一覧を警告せずに存在だけを表示する', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles({
    name: 'media.clip', mimeType: 'application/octet-stream', buffer: await clipMediaFixture(),
  })
  const tree = page.getByTestId('layer-tree')
  await expect(tree.locator('[data-layer-content-kind="audio"]')).toHaveCount(1)
  await expect(tree.locator('[data-layer-content-kind="video"]')).toHaveCount(1)
  await expect(tree.locator('[data-layer-content-kind="camera"]')).toHaveCount(0)
  const files = page.getByRole('listbox', { name: '出力ファイル' })
  await expect(files.getByRole('option')).toHaveCount(2)
  for (const [kind, label] of [['audio', '音声レイヤー'], ['video', 'ビデオレイヤー']]) {
    const row = tree.locator('[data-layer-id]').filter({ has: page.locator(`[data-layer-content-kind="${kind}"]`) })
    await expect(row.getByRole('img', { name: label, exact: true })).toBeVisible()
    await expect(row.locator('[data-layer-column="visibility"]')).toHaveText('—')
    await expect(row.locator('button[data-layer-column="visibility"]')).toHaveCount(0)
    await expect(row).toHaveAttribute('draggable', 'false')
    await row.click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: `${label}：静止画出力の対象外` })).toBeDisabled()
    await expect(page.getByRole('menuitemcheckbox')).toHaveCount(0)
    await page.keyboard.press('Escape')
  }
  for (const option of await files.getByRole('option').all()) await option.click()
  await expect(files).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByRole('button', { name: /^描画の警告/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^再現状況/ })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('media-layers.png') })
  expect(errors).toEqual([])
})
