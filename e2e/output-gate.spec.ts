import { expect, test, type Page } from './fixtures'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'
import { manyOutputs } from './helpers/many-outputs'

const board = (page: Page) => page.getByTestId('tiled-preview')
const list = (page: Page) => page.getByRole('listbox', { name: '出力ファイル', exact: true })
async function load(page: Page, count = 6) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined })
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined })
  })
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles(manyOutputs(count))
  await expect(board(page)).toHaveAttribute('data-count', String(count))
  await expect(board(page)).toHaveAttribute('aria-busy', 'false')
}
async function point(page: Page, index: number) {
  return board(page).evaluate((el, index) => {
    const l = JSON.parse(el.dataset.layout!), c = JSON.parse(el.dataset.camera!), r = el.getBoundingClientRect()
    return { x: r.x + c.x + (index % l.columns * l.stepX + l.tileWidth / 2) * c.zoom,
      y: r.y + c.y + (Math.floor(index / l.columns) * l.stepY + l.tileHeight / 2) * c.zoom }
  }, index)
}
async function gatePoint(page: Page, index: number) {
  return board(page).evaluate((el, index) => {
    const l = JSON.parse(el.dataset.layout!), c = JSON.parse(el.dataset.camera!), r = el.getBoundingClientRect()
    return { x: r.x + c.x + (index % l.columns * l.stepX + l.tileWidth) * c.zoom - 11,
      y: r.y + c.y + (Math.floor(index / l.columns) * l.stepY + l.tileHeight) * c.zoom + 13 }
  }, index)
}
async function listGatePoint(page: Page, index: number) {
  const rect = (await list(page).locator('[data-output-gate]').nth(index).boundingBox())!
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}
async function click(page: Page, index: number, keys: string[] = []) {
  for (const key of keys) await page.keyboard.down(key)
  const p = await point(page, index); await page.mouse.click(p.x, p.y)
  for (const key of keys.reverse()) await page.keyboard.up(key)
}
async function rectangle(page: Page, a: number, b: number, keys: string[], cancel = false) {
  const p = await point(page, a), q = await point(page, b)
  for (const key of keys) await page.keyboard.down(key)
  await page.mouse.move(p.x, p.y); await page.mouse.down()
  await page.mouse.move(q.x + 10, q.y + 10, { steps: 5 })
  await expect(board(page).locator('[data-board-marquee]')).toBeVisible()
  if (cancel) await page.keyboard.press('Escape')
  await page.mouse.up()
  for (const key of keys.reverse()) await page.keyboard.up(key)
  await expect(board(page).locator('[data-board-marquee]')).toBeHidden()
}
async function gateMenu(page: Page, action: string) {
  await page.getByRole('button', { name: 'タイル表示のメニュー', exact: true }).click()
  await page.getByRole('menuitem', { name: action, exact: true }).click()
}
async function download(page: Page, action: () => Promise<void>) {
  const pending = page.waitForEvent('download'); await action()
  return Object.keys(unzipSync(await readFile((await (await pending).path())!))).filter(name => /\.(jpg|png)$/.test(name)).sort()
}

test('タイルのCtrl・Shift選択と矩形の追加・反転・解除、パン、ダブルクリックを両立する', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await load(page, 24)
  await click(page, 0); await click(page, 3, ['Control'])
  await expect(board(page)).toHaveAttribute('data-selected-count', '2')
  await click(page, 5, ['Shift'])
  await expect(board(page)).toHaveAttribute('data-selected-count', '3')
  await click(page, 7, ['Control', 'Shift'])
  await expect(board(page)).toHaveAttribute('data-selected-count', '5')
  await board(page).press('Escape')
  const camera = await board(page).getAttribute('data-camera')
  await rectangle(page, 0, 1, ['Shift'])
  await expect(board(page)).toHaveAttribute('data-selected-count', '2')
  await rectangle(page, 0, 2, ['Control'])
  await expect(board(page)).toHaveAttribute('data-selected-count', '1')
  await rectangle(page, 2, 2, ['Control', 'Shift'])
  await expect(board(page)).toHaveAttribute('data-selected-count', '0')
  await rectangle(page, 0, 1, ['Shift'], true)
  await expect(board(page)).toHaveAttribute('data-selected-count', '0')
  await expect(board(page)).toHaveAttribute('data-camera', camera!)
  const p = await point(page, 0)
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 40, p.y + 30, { steps: 4 })
  await expect(board(page)).toHaveCSS('cursor', 'grabbing'); await page.mouse.up()
  await expect(board(page)).not.toHaveAttribute('data-camera', camera!)
  await expect(board(page)).toHaveAttribute('data-selected-count', '0')
  await board(page).getByRole('button', { name: '画面に収める' }).click()
  await click(page, 0); await click(page, 1, ['Control'])
  const q = await point(page, 0); await page.mouse.dblclick(q.x, q.y)
  const single = page.getByLabel('１点表示の画像', { exact: true })
  await expect(single).toBeVisible(); await single.dblclick()
  await expect(board(page)).toHaveAttribute('data-selected-count', '2')
  await expect(list(page).getByRole('option', { selected: true })).toHaveCount(2)
})

test('出力OFFは一覧とタイルに残り、全件・選択ZIPへ混入せず、Undoと全復帰ができる', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await load(page)
  const names = await list(page).getByRole('option').evaluateAll(rows => rows.map(row => row.getAttribute('aria-label')!))
  await click(page, 0); await click(page, 1, ['Control'])
  await gateMenu(page, '選択を出力から外す')
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(2)
  await expect(board(page)).toHaveAttribute('data-count', '6')
  expect(await download(page, () => page.getByRole('button', { name: '出力', exact: true }).click())).toEqual(names.slice(2).sort())
  await click(page, 2, ['Control'])
  await page.getByRole('button', { name: '出力一覧のメニュー', exact: true }).click()
  expect(await download(page, () => page.getByRole('menuitem', { name: '選択項目をZIPに書き出し' }).click())).toEqual([names[2]])
  await board(page).press('Control+z')
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(0)
  await board(page).press('Control+Shift+z')
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(2)
  await board(page).press('Control+a'); await gateMenu(page, '選択を出力から外す')
  await expect(page.getByRole('button', { name: '出力', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '出力一覧のメニュー', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: '選択項目をZIPに書き出し' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await page.screenshot({ path: info.outputPath('output-off.png') })
  await gateMenu(page, 'すべて出力に戻す')
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '出力', exact: true })).toBeEnabled()
  // The tile action lives in the filename band, outside the image.
  const p = await point(page, 0); await page.mouse.move(p.x, p.y)
  const gate = board(page).locator('[data-board-gate]')
  await expect(gate).toHaveAttribute('aria-label', `${names[0]}を出力から外す`)
  await expect(gate).toBeVisible(); await gate.click()
  await expect(list(page).getByRole('option', { name: names[0], exact: true })).toHaveAttribute('data-output-off', 'true')
  await list(page).getByRole('button', { name: `${names[0]}を出力に戻す`, exact: true }).click()
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(0)
})

test('設定変更とレイヤー非表示・復帰でも同じ出力をOFFに保つ', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await load(page)
  const row = list(page).getByRole('option').first(), oldName = (await row.getAttribute('aria-label'))!
  await row.getByRole('button', { name: `${oldName}を出力から外す`, exact: true }).click()
  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  const settings = page.getByRole('dialog', { name: '書き出し設定', exact: true })
  await settings.getByRole('button', { name: 'PNG', exact: true }).click()
  await settings.getByRole('switch', { name: 'フォルダ分け', exact: true }).click()
  await page.keyboard.press('Escape')
  const renamed = list(page).getByRole('option', { name: `A/${oldName.replace('.jpg', '.png')}`, exact: true })
  await expect(renamed).toHaveAttribute('data-output-off', 'true')
  const sourceId = (await renamed.getAttribute('data-output-source-id'))!
  const layer = page.getByTestId('layer-tree').locator(`[data-layer-id="${sourceId}"]`)
  await renamed.click(); await page.getByRole('button', { name: '選択中の出力をツリーで表示' }).click()
  await layer.getByRole('button', { name: 'レイヤーを非表示にする', exact: true }).click()
  await expect(renamed).toHaveCount(0)
  await layer.getByRole('button', { name: 'レイヤーを表示する', exact: true }).click()
  await expect(renamed).toHaveAttribute('data-output-off', 'true')
})

test('除外アイコンは左端の同じ位置に常時表示し、ファイル名は行の右端まで使える', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await load(page)
  await page.mouse.move(4, 4)
  const geometry = await list(page).getByRole('option').evaluateAll(rows => rows.map(row => {
    const button = row.querySelector<HTMLElement>('[data-output-gate]')!, style = getComputedStyle(button)
    const gate = button.getBoundingClientRect(), thumbnail = row.querySelector('canvas')!.getBoundingClientRect()
    const name = row.querySelector('[data-output-name]')!.getBoundingClientRect(), rect = row.getBoundingClientRect()
    return { x: gate.x, gateRight: gate.right, thumbnailX: thumbnail.x, nameX: name.x, nameRight: name.right, right: rect.right,
      opacity: style.opacity, visible: style.visibility, color: style.color, path: button.querySelector('path')!.getAttribute('d') }
  }))
  for (const row of geometry) {
    expect(row.x).toBeCloseTo(geometry[0].x, 1)
    expect(row.gateRight).toBeLessThan(row.thumbnailX)
    expect(row.thumbnailX).toBeLessThan(row.nameX)
    expect(row.right - row.nameRight).toBeLessThanOrEqual(5)
    expect(row.opacity).toBe('1'); expect(row.visible).toBe('visible')
  }
  const gate = list(page).locator('[data-output-gate]').first()
  await expect(gate.locator('path').last()).toBeHidden()
  await gate.click(); await page.mouse.move(4, 4)
  await expect(gate).toHaveAttribute('aria-pressed', 'true')
  expect(await gate.locator('path').first().getAttribute('d')).toBe(geometry[0].path)
  await expect(gate.locator('path').last()).toBeVisible()
  expect(await gate.evaluate(el => getComputedStyle(el).color)).not.toBe(geometry[0].color)
  await expect(gate).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(gate).toHaveCSS('box-shadow', 'none')
  await expect(gate).toHaveCSS('outline-style', 'none')
  await gate.hover()
  await expect(gate).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(gate).toHaveCSS('border-width', '0px')
  await page.mouse.move(4, 4)
  await page.screenshot({ path: info.outputPath('output-exclusion-controls.png') })
  await gate.press('Space')
  await expect(gate).toHaveAttribute('aria-pressed', 'false')
  await expect(gate.locator('path').last()).toBeHidden()
  await expect(gate).toHaveCSS('outline-style', 'solid')
})

test('選択中は混在状態も押したアイコンにそろえ、選択外の操作と検索中も選択を保つ', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await load(page)
  const rows = list(page).getByRole('option'), gates = list(page).locator('[data-output-gate]')
  await list(page).press('Escape')
  await gates.nth(0).click()
  await rows.nth(0).click(); await rows.nth(1).click({ modifiers: ['Control'] })
  await expect(gates.nth(0)).toHaveAttribute('aria-description', '選択した2件を出力に戻す')
  await gates.nth(0).click()
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(0)
  await expect(list(page).getByRole('option', { selected: true })).toHaveCount(2)
  await gates.nth(2).click()
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(1)
  await expect(rows.nth(2)).toHaveAttribute('data-output-off', 'true')
  await expect(list(page).getByRole('option', { selected: true })).toHaveCount(2)
  const firstName = (await rows.nth(0).getAttribute('aria-label'))!
  await page.getByRole('button', { name: '出力ファイル名を検索', exact: true }).click()
  await page.getByRole('searchbox', { name: '出力ファイル名を検索' }).fill(firstName)
  await expect(rows).toHaveCount(1)
  await gates.first().focus(); await page.keyboard.press('Space')
  await page.getByRole('button', { name: '検索を解除して閉じる', exact: true }).click()
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(3)
  await list(page).press('Control+z')
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(1)
  await expect(list(page).getByRole('option', { selected: true })).toHaveCount(2)
})

test('高速ななぞりと往復は同じ状態にそろえ、1回のUndoとRedoで戻せる', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await load(page)
  await list(page).press('Escape')
  await list(page).locator('[data-output-gate]').nth(1).click()
  const a = await listGatePoint(page, 0), b = await listGatePoint(page, 3)
  await page.mouse.move(a.x, a.y); await page.mouse.down()
  await page.mouse.move(b.x, b.y)
  await page.mouse.move(a.x, a.y)
  await page.mouse.up()
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(4)
  await expect(list(page).getByRole('option', { selected: true })).toHaveCount(0)
  await list(page).press('Control+z')
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(1)
  await list(page).press('Control+Shift+z')
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(4)
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y); await page.mouse.up()
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(0)
  await list(page).press('Control+z')
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(4)
})

test('pointercancelとフォーカス喪失でなぞりを終了し、次の操作は別のUndoになる', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await load(page)
  await list(page).press('Escape')
  await list(page).evaluate((el: HTMLElement) => el.addEventListener('pointerdown', event => { el.dataset.testPointer = String(event.pointerId) }))
  const a = await listGatePoint(page, 0), b = await listGatePoint(page, 1)
  for (const reason of ['pointercancel', 'blur']) {
    await page.mouse.move(a.x, a.y); await page.mouse.down()
    if (reason === 'pointercancel') await list(page).dispatchEvent('pointercancel', { pointerId: Number(await list(page).getAttribute('data-test-pointer')) })
    else await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await page.mouse.move(b.x, b.y); await page.mouse.up()
    await expect(list(page).locator('[data-output-off=true]')).toHaveCount(1)
    await list(page).press('Control+z')
    await expect(list(page).locator('[data-output-off=true]')).toHaveCount(0)
  }
  await list(page).locator('[data-output-gate]').nth(1).click()
  await expect(list(page).getByRole('option').nth(1)).toHaveAttribute('data-output-off', 'true')
  await list(page).press('Control+z')
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(0)
})

test('タイルのアイコンも複数選択となぞりに対応し、カメラと選択を変えない', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await load(page)
  await click(page, 0); await click(page, 1, ['Control'])
  const a = await gatePoint(page, 0), b = await gatePoint(page, 1)
  const camera = await board(page).getAttribute('data-camera')
  await page.mouse.click(a.x, a.y)
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(2)
  await expect(board(page)).toHaveAttribute('data-selected-count', '2')
  await board(page).press('Control+z')
  await board(page).press('Escape')
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y); await page.mouse.up()
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(2)
  await expect(board(page)).toHaveAttribute('data-selected-count', '0')
  await expect(board(page)).toHaveAttribute('data-camera', camera!)
  await board(page).press('Control+z')
  await expect(list(page).locator('[data-output-off=true]')).toHaveCount(0)
})

test.describe('出力除外のタッチ操作', () => {
  test.use({ hasTouch: true, viewport: { width: 1440, height: 900 } })
  test('一覧をなぞって一括復帰でき、タイルはホバーせずに除外できる', async ({ page }) => {
    await load(page); await list(page).press('Escape')
    const a = await listGatePoint(page, 0), b = await listGatePoint(page, 2)
    const cdp = await page.context().newCDPSession(page)
    for (const count of [3, 0]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [b] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await expect(list(page).locator('[data-output-off=true]')).toHaveCount(count)
    }
    const p = await gatePoint(page, 0)
    await page.touchscreen.tap(p.x, p.y)
    await expect(list(page).getByRole('option').nth(0)).toHaveAttribute('data-output-off', 'true')
    await expect(board(page)).toHaveAttribute('data-selected-count', '0')
    await cdp.detach()
  })
})

test.describe('タッチの範囲選択', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
  test('モード中はタップで複数選択、ドラッグで追加し、ピンチでは選択を変えない', async ({ page }) => {
    await load(page)
    await board(page).getByRole('button', { name: '範囲選択', exact: true }).tap()
    await board(page).press('Escape')
    await expect(board(page)).toHaveAttribute('data-selected-count', '0')
    const a = await point(page, 0), b = await point(page, 1)
    await page.touchscreen.tap(a.x, a.y); await page.touchscreen.tap(b.x, b.y)
    await expect(board(page)).toHaveAttribute('data-selected-count', '2')
    await page.touchscreen.tap(b.x, b.y)
    await expect(board(page)).toHaveAttribute('data-selected-count', '1')
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...a }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...b }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(board(page)).toHaveAttribute('data-selected-count', '2')
    const zoom = Number(await board(page).getAttribute('data-zoom'))
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x - 10, y: a.y }, { x: a.x + 10, y: a.y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x - 30, y: a.y }, { x: a.x + 30, y: a.y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(async () => Number(await board(page).getAttribute('data-zoom'))).toBeGreaterThan(zoom)
    await expect(board(page)).toHaveAttribute('data-selected-count', '2')
    await expect(board(page).locator('canvas')).toHaveCount(2)
    await cdp.detach()
  })
})
