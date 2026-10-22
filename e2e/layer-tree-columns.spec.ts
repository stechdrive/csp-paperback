import { expect, test, type Page } from './fixtures'
import { clipVectorFixture } from './helpers/clip-vector-fixture'
import { clickLayerAction } from './helpers/layer-action'

const tree = (page: Page) => page.getByTestId('layer-tree')
const files = (page: Page) => page.getByRole('listbox', { name: '出力ファイル' })

async function columns(page: Page) {
  return tree(page).locator('[data-layer-id]').evaluateAll(rows => rows.map(row =>
    Object.fromEntries([...row.querySelectorAll<HTMLElement>('[data-layer-column]')].map(cell => {
      const rect = cell.getBoundingClientRect()
      return [cell.dataset.layerColumn!, { x: rect.x, width: rect.width }] as const
    }).filter(([name]) => name === 'visibility')),
  ))
}

async function expectAligned(page: Page) {
  const heights = await tree(page).locator('[data-layer-id]').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height))
  expect(heights.every(height => height === 22), `row heights: ${heights.join(',')}`).toBe(true)
  const positions = await columns(page)
  expect(positions.length).toBeGreaterThan(5)
  for (const row of positions) {
    expect(Object.keys(row)).toHaveLength(1)
    for (const [name, rect] of Object.entries(row)) {
      expect(rect.x, name).toBeCloseTo(positions[0][name].x, 1)
      expect(rect.width, name).toBeCloseTo(positions[0][name].width, 1)
    }
  }
  expect(await tree(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  return positions[0]
}

async function resizeSource(page: Page, width: number) {
  const source = page.getByTestId('source-panel')
  const box = (await source.boundingBox())!
  const handle = (await page.locator('[class*="_resizeHandle_"]').last().boundingBox())!
  const x = handle.x + handle.width / 2, y = handle.y + 30
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + box.width - width, y, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await source.boundingBox())!.width).toBeCloseTo(Math.max(380, width), 0)
  const output = (await files(page).boundingBox())!, layers = (await tree(page).boundingBox())!
  expect(output.x + output.width).toBeLessThan(layers.x)
}

test('必要なラベルだけに幅を使い、目の列は階層や状態にかかわらず固定する', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1000 })
  await page.goto('./')
  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  await expect(tree(page).locator('[data-output-state="name-excluded"]').first()).toHaveText('除外指定')

  for (const width of [520, 320, 900]) {
    await resizeSource(page, width)
    const before = await expectAligned(page)
    await files(page).getByRole('option', { name: 'B_1_s.jpg', exact: true }).click()
    await expect(tree(page).locator('[data-source-role]').first()).toBeAttached()
    await expect(tree(page).locator('[data-layer-column="usage"], [data-contribution-count]')).toHaveCount(0)
    const exclusion = tree(page).locator('[data-output-state="name-excluded"]').first()
    expect(await exclusion.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(0)
    expect((await exclusion.boundingBox())!.width).toBeLessThan(50)
    expect(await expectAligned(page)).toEqual(before)
    await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
    const settings = page.getByRole('dialog', { name: '書き出し設定', exact: true })
    await settings.getByRole('button', { name: '作画', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(tree(page).locator('[data-output-state="off"], [data-output-state="partial"]').first()).toBeAttached()
    expect(await expectAligned(page)).toEqual(before)
    await page.screenshot({ path: testInfo.outputPath(`tree-columns-${width}.png`) })
    await tree(page).focus()
    await page.keyboard.press('Control+z')
  }

  const before = await expectAligned(page)
  const folder = tree(page).locator('[data-layer-id]').filter({ has: page.getByText('_撮影指示', { exact: true }) })
  await clickLayerAction(page, folder, 'animation')
  await expect(folder.locator('[data-layer-output-role]')).toHaveAttribute('data-layer-output-role', 'animation')
  expect(await expectAligned(page)).toEqual(before)
  await tree(page).focus()
  await page.keyboard.press('Control+z')
  const memo = tree(page).locator('[data-layer-id]').filter({ has: page.getByText('memo', { exact: true }) })
  const emptyLabels = memo.locator('[class*="_statusColumns_"]')
  await expect(emptyLabels).toBeHidden()
  await clickLayerAction(page, memo, 'individual')
  await expect(memo.locator('[data-layer-output-role]')).toHaveAttribute('data-layer-output-role', 'individual')
  expect(await expectAligned(page)).toEqual(before)
  const identity = memo.locator('[data-layer-column="name"]')
  expect((await identity.boundingBox())!.width).toBeGreaterThan((await tree(page).boundingBox())!.width - 110)
})

test('非表示素材を仮想セルで使う場合だけ短いラベルを表示し、選択解除で消す', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('./')
  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  await files(page).getByRole('option', { name: '仮想セルテスト.jpg', exact: true }).click()
  const original = tree(page).locator('[data-layer-id]').filter({ has: page.getByText('_原図', { exact: true }) })
  const collapse = original.getByRole('button', { name: '_原図を折りたたむ', exact: true })
  if (await collapse.count()) await collapse.click()
  await original.getByRole('button', { name: 'レイヤーを非表示にする', exact: true }).click()
  const label = original.locator('[data-layer-virtual-use]')
  await expect(label).toBeVisible()
  await expect(label).toHaveText('仮想セル')
  expect((await label.boundingBox())!.width).toBeLessThan(50)
  // Escape should clear selection after any visibility-button tooltip closes.
  await page.mouse.move(1, 1)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('virtual-cell-label.png') })
  await files(page).press('Escape')
  await expect(label).toBeHidden()
  await expect(tree(page).locator('[data-source-role]')).toHaveCount(0)
})

test('階層をまたいで縦一直線になぞり、1回のUndoとRedoで表示状態を復元する', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('./')
  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  const folder = tree(page).locator('[data-layer-id]').filter({ has: page.getByText('_撮影指示', { exact: true }) })
  const expand = folder.getByRole('button', { name: '_撮影指示を展開する', exact: true })
  if (await expand.count()) await expand.click()
  const first = folder.locator('[data-layer-column="visibility"]')
  const last = tree(page).locator('[data-layer-id]').filter({ has: page.getByText('_PAN', { exact: true }) }).locator('[data-layer-column="visibility"]')
  await last.scrollIntoViewIfNeeded()
  const a = (await first.boundingBox())!, b = (await last.boundingBox())!
  expect(a.x).toBeCloseTo(b.x, 1)
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await expect(last).toHaveAttribute('aria-pressed', 'true')
  const x = a.x + a.width / 2
  await page.mouse.move(x, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, b.y + b.height / 2, { steps: Math.ceil(Math.abs(b.y - a.y) / 4) })
  await page.mouse.up()
  await expect(first).toHaveAttribute('aria-pressed', 'false')
  await expect(last).toHaveAttribute('aria-pressed', 'false')
  await tree(page).focus()
  await page.keyboard.press('Control+z')
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await expect(last).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Control+Shift+z')
  await expect(first).toHaveAttribute('aria-pressed', 'false')
  await expect(last).toHaveAttribute('aria-pressed', 'false')
})

test('ファイル名ホバーを出さず、警告の詳細と解消後の列位置を保つ', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'c001.clip', mimeType: 'application/octet-stream', buffer: await clipVectorFixture() })
  const warning = files(page).getByRole('button', { name: /^描画の警告/ }).first()
  await expect(warning).toBeVisible({ timeout: 30000 })
  const output = files(page).getByRole('option').filter({ has: page.getByRole('button', { name: /^描画の警告/ }) }).first()
  const filename = (await output.getAttribute('aria-label'))!
  const name = output.locator('[data-output-name]')
  await name.hover()
  await page.waitForTimeout(400)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  const before = await expectAligned(page)
  const nameBefore = (await name.boundingBox())!
  await warning.click()
  const popup = page.getByRole('dialog', { name: '描画の警告', exact: true })
  await expect(popup).toContainText('近似描画')
  await page.keyboard.press('Escape')
  await page.locator('input[type=file][multiple]').setInputFiles('testdata/c001.psd')
  await expect(files(page).getByRole('button', { name: /^描画の警告/ })).toHaveCount(0)
  expect(await expectAligned(page)).toEqual(before)
  // Pairing replaces the row, so find the same name again without its warning.
  const resolved = files(page).getByRole('option', { name: filename, exact: true })
  const nameAfter = (await resolved.locator('[data-output-name]').boundingBox())!
  expect(nameAfter.x).toBeCloseTo(nameBefore.x, 1)
  expect(nameAfter.width).toBeCloseTo(nameBefore.width, 1)
})
