import { expect, test, type Page } from './fixtures'
import { clipDisplayFixture } from './helpers/clip-display-fixture'
import { clickLayerAction } from './helpers/layer-action'

const tree = (page: Page) => page.getByTestId('layer-tree')
const row = (page: Page, name: string) => tree(page).locator('[data-layer-id]').filter({ has: page.getByText(name, { exact: true }) })

test('CLIPの種類・色・マスクを表示し、PSD追加後も保持する', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  const fill = row(page, '演出修正用紙')
  await expect(fill.locator('[data-layer-content-kind]')).toHaveAttribute('data-layer-content-kind', 'fill')
  await expect(fill.locator('[data-layer-mask]')).toHaveAttribute('data-layer-mask', 'enabled')
  await expect(row(page, '用紙').locator('[data-layer-content-kind]')).toHaveAttribute('data-layer-content-kind', 'paper')
  const before = await tree(page).locator('[data-palette-color]').evaluateAll(items => items.map(item => item.getAttribute('data-palette-color')))
  expect(before).toContain('#ffd0d0')
  expect(before).toContain('#ffffb4')
  await page.locator('input[type=file][multiple]').setInputFiles('testdata/c001.psd')
  await expect(fill.locator('[data-layer-content-kind]')).toHaveAttribute('data-layer-content-kind', 'fill')
  await expect(fill.locator('[data-layer-mask]')).toHaveAttribute('data-layer-mask', 'enabled')
  expect(await tree(page).locator('[data-palette-color]').evaluateAll(items => items.map(item => item.getAttribute('data-palette-color')))).toEqual(before)
})

test('297pxのツリーで境界とマスクを個別表示し、ない行では名前へ幅を戻す', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const measurements = []
  for (const mask of ['none', 'enabled', 'disabled'] as const) {
    await page.goto('./')
    await page.locator('input[type=file][multiple]').setInputFiles({ name: 'c001.clip', mimeType: 'application/octet-stream', buffer: await clipDisplayFixture(mask) })
    const bg = row(page, '_BG')
    await expect(bg.locator('[data-layer-effect="edge"]')).toBeVisible()
    await expect(bg.locator('[data-layer-effect="color"]')).toBeVisible()
    await expect(bg.locator('[data-layer-mask]')).toHaveCount(mask === 'none' ? 0 : 1)
    if (mask !== 'none') await expect(bg.locator('[data-layer-mask]')).toHaveAttribute('data-layer-mask', mask)
    await expect(bg.locator('[data-palette-color]')).toHaveAttribute('data-palette-color', '#c5d9c4')
    expect((await tree(page).boundingBox())!.width).toBeGreaterThan(290)
    expect((await tree(page).boundingBox())!.width).toBeLessThan(300)
    measurements.push(await bg.evaluate(el => {
      const rect = (selector: string) => el.querySelector(selector)!.getBoundingClientRect()
      return { name: rect('[data-layer-column="name"]').width, indicators: rect('[data-layer-column="indicators"]').width,
        operations: rect('[data-layer-column="actions"]').x, height: el.getBoundingClientRect().height }
    }))
    const plain = row(page, 'memo')
    expect((await plain.locator('[data-layer-column="indicators"]').boundingBox())!.width).toBe(0)
    await bg.scrollIntoViewIfNeeded()
    await tree(page).screenshot({ path: info.outputPath(`mask-${mask}.png`) })
  }
  expect(measurements.map(item => item.height)).toEqual([22, 22, 22])
  expect(measurements[1].name).toBe(measurements[0].name - 17)
  expect(measurements[1].indicators).toBe(measurements[0].indicators + 17)
  expect(measurements[2]).toEqual(measurements[1])
})

test('狭い幅の補助操作で手動指定・Undo・出力名編集を利用できる', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  const folder = row(page, '_撮影指示')
  await clickLayerAction(page, folder, 'animation', true)
  await expect(page.getByRole('dialog', { name: /の補助操作$/ })).toHaveCount(0)
  await expect(folder.locator('[data-layer-icon]')).toHaveAttribute('data-layer-icon', 'animation')
  await tree(page).focus()
  await page.keyboard.press('Control+z')
  await expect(folder.locator('[data-layer-icon]')).toHaveAttribute('data-layer-icon', 'folder')
  const bg = row(page, '_BG')
  const bgId = await bg.getAttribute('data-layer-id')
  await bg.getByRole('button', { name: '_BGの補助操作' }).click()
  await page.getByRole('dialog', { name: '_BGの補助操作' }).getByRole('button', { name: '出力名を編集' }).click()
  const input = bg.getByRole('textbox', { name: '_BGの出力名' })
  await expect(input).toBeFocused()
  await input.fill('背景完成')
  await input.press('Enter')
  await expect(tree(page).locator(`[data-layer-id="${bgId}"] [data-layer-name]`)).toHaveText('背景完成')
})
