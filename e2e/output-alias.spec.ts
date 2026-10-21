import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'
import { manyOutputs } from './helpers/many-outputs'

const tree = (page: Page) => page.getByTestId('layer-tree')
const name = (page: Page) => tree(page).locator('[data-layer-name]').first()
const list = (page: Page) => page.getByRole('listbox', { name: '出力ファイル', exact: true })
async function load(page: Page, theme = 'paper', folder = 'A') {
  await page.addInitScript(theme => {
    localStorage.setItem('csp-paperback:settings', JSON.stringify({ state: { activeTheme: theme }, version: 2 }))
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined })
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined })
  }, theme)
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles(manyOutputs(3, folder))
  await expect(page.getByTestId('tiled-preview')).toHaveAttribute('aria-busy', 'false')
}

for (const theme of ['paper', 'midnight', 'graphite']) {
  test(`文字の位置・書体・行幅を保って編集する (${theme})`, async ({ page }, info) => {
    await page.setViewportSize({ width: theme === 'graphite' ? 1100 : 1440, height: 900 })
    const original = theme === 'graphite' ? '原図' : 'A'
    await load(page, theme, original)
    await name(page).click()
    const slot = name(page).locator('..')
    const before = await slot.boundingBox()
    const font = await slot.evaluate(el => {
      const s = getComputedStyle(el)
      return { family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, line: s.lineHeight, spacing: s.letterSpacing, color: s.color }
    })
    const pixels = await slot.screenshot()
    await name(page).dblclick()
    const input = page.getByRole('textbox', { name: `${original}の出力名` })
    await expect(input).toBeFocused()
    expect(await input.boundingBox()).toEqual(before)
    const editing = await input.evaluate(el => {
      const s = getComputedStyle(el)
      return { family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, line: s.lineHeight, spacing: s.letterSpacing, color: s.color }
    })
    expect(editing).toEqual(font)
    await expect(input).toHaveCSS('border-width', '0px')
    await expect(input).toHaveCSS('box-shadow', 'none')
    await input.evaluate(el => { el.setSelectionRange(0, 0); el.style.caretColor = 'transparent' })
    const editingPixels = await slot.screenshot()
    if (!editingPixels.equals(pixels)) {
      await info.attach('before-edit', { body: pixels, contentType: 'image/png' })
      await info.attach('during-edit', { body: editingPixels, contentType: 'image/png' })
    }
    expect(editingPixels.equals(pixels)).toBe(true)
    await input.fill('日本語/背景')
    await expect(page.getByRole('status', { name: '出力名の確認' })).toContainText('日本語_背景')
    expect(await slot.boundingBox()).toEqual(before)
    await page.screenshot({ path: info.outputPath(`alias-edit-${theme}.png`) })
    await input.press('Escape')
    await expect(name(page)).toHaveText(original)
  })
}

test('別名を一覧・タイル・ZIPへ反映し、出力OFF・Undo・取消を維持する', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await load(page)
  const first = list(page).getByRole('option').first()
  const oldName = (await first.getAttribute('aria-label'))!
  await first.getByRole('button').click()
  await name(page).click(); await tree(page).press('F2')
  const input = page.getByRole('textbox', { name: 'Aの出力名' })
  await input.fill('新規/素材')
  await expect(first).toHaveAttribute('aria-label', oldName)
  await input.press('Enter')
  await expect(name(page)).toHaveText('新規_素材')
  await expect(first).toHaveAttribute('data-output-off', 'true')
  const names = await list(page).getByRole('option').evaluateAll(rows => rows.map(row => row.getAttribute('aria-label')!))
  expect(names.every(value => value.startsWith('新規_素材'))).toBe(true)
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: '出力', exact: true }).click()
  const zip = unzipSync(await readFile((await (await pending).path())!))
  expect(Object.keys(zip).filter(value => value.endsWith('.jpg')).sort()).toEqual(names.slice(1).sort())
  await tree(page).press('Control+z')
  await expect(name(page)).toHaveText('A')
  await expect(first).toHaveAttribute('aria-label', oldName)
  await expect(first).toHaveAttribute('data-output-off', 'true')
  await tree(page).press('Control+Shift+z')
  await expect(name(page)).toHaveText('新規_素材')
  await page.screenshot({ path: info.outputPath('alias-applied.png') })
})

test.describe('タッチでの出力名指定', () => {
  test.use({ hasTouch: true })
  test('メニューから編集・確定・復帰でき、狭い画面にはみ出さない', async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 900 }); await load(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('navigation', { name: '作業パネル' }).getByRole('button', { name: 'レイヤー' }).tap()
    const outputRow = list(page).getByRole('option').first()
    const rowBounds = (await outputRow.boundingBox())!, thumbnail = (await outputRow.locator('canvas').boundingBox())!
    const outputName = (await outputRow.locator('[data-output-name]').boundingBox())!
    expect(outputName.x).toBeGreaterThanOrEqual(thumbnail.x + thumbnail.width)
    expect(outputName.width).toBeGreaterThanOrEqual(rowBounds.width - thumbnail.width - 40)
    await name(page).tap()
    const before = await name(page).locator('..').boundingBox()
    await page.getByRole('button', { name: '素材レイヤーのメニュー' }).tap()
    await page.getByRole('menuitem', { name: '出力名を指定…' }).tap()
    const input = page.getByRole('textbox', { name: 'Aの出力名' })
    await expect(input).toBeFocused()
    expect(await input.boundingBox()).toEqual(before)
    await input.fill('背景')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const feedback = (await page.getByRole('status', { name: '出力名の確認' }).boundingBox())!
    expect(feedback.x + feedback.width).toBeLessThanOrEqual(390)
    await page.screenshot({ path: info.outputPath('alias-mobile.png') })
    await input.press('Enter')
    await expect(name(page)).toHaveText('背景')
    await page.getByRole('button', { name: '素材レイヤーのメニュー' }).tap()
    await page.getByRole('menuitem', { name: '元の名前を使う' }).tap()
    await expect(name(page)).toHaveText('A')
  })
})
