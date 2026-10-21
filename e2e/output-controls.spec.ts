import { expect, test, type Page } from '@playwright/test'
import { manyOutputs } from './helpers/many-outputs'

const list = (page: Page) => page.getByRole('listbox', { name: '出力ファイル', exact: true })
const board = (page: Page) => page.getByTestId('tiled-preview')
test.setTimeout(60_000)

async function load(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles(manyOutputs(3))
  await expect(board(page)).toHaveAttribute('aria-busy', 'false')
}

async function expectEmpty(page: Page) {
  await expect(list(page).getByRole('option', { selected: true })).toHaveCount(0)
  await expect(list(page).locator('[data-active-output="true"]')).toHaveCount(0)
  await expect(board(page)).toHaveAttribute('data-selected-count', '0')
  await expect(page.getByTestId('preview-file-name')).toHaveCount(0)
  await expect(page.getByTestId('output-connections').locator('path')).toHaveCount(0)
}

test('空白クリック・Esc・最後のCtrl解除・メニュー解除で注目項目も残さず未選択にする', async ({ page }) => {
  await load(page)
  const row = list(page).getByRole('option').first()
  await row.click()
  const bounds = (await list(page).boundingBox())!
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height - 10)
  await expectEmpty(page)
  await row.click(); await list(page).press('Escape'); await expectEmpty(page)
  await row.click(); await row.click({ modifiers: ['Control'] }); await expectEmpty(page)
  await row.click()
  await page.getByRole('button', { name: '出力一覧のメニュー', exact: true }).click()
  await page.getByRole('menuitem', { name: '選択を解除', exact: true }).click()
  await expectEmpty(page)
  await row.click(); await board(page).click({ position: { x: 4, y: 4 } }); await expectEmpty(page)
  await row.click(); await board(page).press('Escape'); await expectEmpty(page)
  await row.click()
  await page.getByRole('button', { name: 'タイル表示のメニュー', exact: true }).click()
  await page.getByRole('menuitem', { name: '選択を解除', exact: true }).click()
  await expectEmpty(page)
  await page.getByRole('button', { name: '１点表示', exact: true }).click()
  await expect(list(page).getByRole('option', { selected: true })).toHaveCount(1)
  await expect(page.getByLabel('１点表示の画像', { exact: true }).locator('canvas[aria-label]')).toHaveAttribute('aria-label', (await row.getAttribute('aria-label'))!)
})

test('出力を戻すとポインターやフォーカスを動かさずに色と斜線が戻り、Undoでも状態を同期する', async ({ page }) => {
  await load(page)
  const row = list(page).getByRole('option').first()
  const gate = row.getByRole('button')
  const slash = gate.locator('path').last()
  await gate.hover()
  const normalColor = await gate.evaluate(element => getComputedStyle(element).color)
  await gate.click()
  await expect(row).toHaveAttribute('data-output-off', 'true')
  await expect(gate).toHaveAttribute('aria-pressed', 'true')
  await expect(slash).toBeVisible()
  const excludedColor = await gate.evaluate(element => getComputedStyle(element).color)
  expect(excludedColor).not.toBe(normalColor)
  await expect(gate).toHaveCSS('box-shadow', 'none')
  await gate.click()
  await expect(row).toHaveAttribute('data-output-off', 'false')
  await expect(gate).toBeFocused()
  await expect(slash).toBeHidden()
  await expect(gate).toHaveCSS('color', normalColor)
  await expect(gate).toHaveCSS('box-shadow', 'none')
  await expect(gate.locator('svg')).toBeVisible()
  await list(page).press('Control+z')
  await expect(row).toHaveAttribute('data-output-off', 'true')
  await expect(slash).toBeVisible()
  await expect(gate).toHaveCSS('color', excludedColor)
  await list(page).press('Control+Shift+z')
  await expect(slash).toBeHidden()
  await expect(gate).toHaveCSS('color', normalColor)
  await expect(gate).toHaveCSS('box-shadow', 'none')
  const point = await board(page).evaluate(el => {
    const l = JSON.parse(el.dataset.layout!), c = JSON.parse(el.dataset.camera!), r = el.getBoundingClientRect()
    return { x: r.x + c.x + l.tileWidth * c.zoom / 2, y: r.y + c.y + l.tileHeight * c.zoom / 2 }
  })
  await page.mouse.move(point.x, point.y)
  const tileGate = board(page).locator('[data-board-gate]')
  await tileGate.click(); await expect(row).toHaveAttribute('data-output-off', 'true')
  await expect(tileGate.locator('path').last()).toBeVisible()
  await expect(tileGate).toHaveCSS('color', excludedColor)
  await expect(tileGate).toHaveCSS('box-shadow', 'none')
  await tileGate.click(); await expect(row).toHaveAttribute('data-output-off', 'false')
  await expect(tileGate.locator('path').last()).toBeHidden()
  await expect(tileGate).toHaveCSS('color', normalColor)
  await expect(tileGate).toHaveCSS('box-shadow', 'none')
  await expect(tileGate.locator('svg')).toBeVisible()
})

test('名前には操作欄までの幅を使い、ペインメニューを中央上部の右端に揃える', async ({ page }, info) => {
  await load(page)
  const row = list(page).getByRole('option').first(), name = row.locator('[data-output-name]')
  const rowBounds = (await row.boundingBox())!, thumbnail = (await row.locator('canvas').boundingBox())!
  const nameBounds = (await name.boundingBox())!, gateBounds = (await row.getByRole('button').boundingBox())!
  expect(nameBounds.width).toBeGreaterThanOrEqual(rowBounds.width - thumbnail.width - 40)
  expect(gateBounds.x).toBeLessThan(rowBounds.x + 8)
  expect(gateBounds.x + gateBounds.width).toBeLessThanOrEqual(thumbnail.x)
  await row.getByRole('button').click()
  expect((await name.boundingBox())!.width).toBeCloseTo(nameBounds.width, 1)
  const toolbar = (await page.getByRole('group', { name: 'メインプレビューの表示' }).boundingBox())!
  const menu = (await page.getByRole('button', { name: 'タイル表示のメニュー', exact: true }).boundingBox())!
  expect(menu.y).toBeGreaterThanOrEqual(toolbar.y)
  expect(menu.y + menu.height).toBeLessThanOrEqual(toolbar.y + toolbar.height)
  expect(menu.x + menu.width).toBeGreaterThan(toolbar.x + toolbar.width - 12)
  await page.getByRole('button', { name: 'タイル表示のメニュー', exact: true }).click()
  await expect(page.getByRole('menu', { name: '選択したタイルの操作' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'タイル表示のメニュー', exact: true })).toBeFocused()
  await page.screenshot({ path: info.outputPath('compact-output-controls.png') })
})
