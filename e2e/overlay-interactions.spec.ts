import { expect, test, type Page } from '@playwright/test'
import { clipVectorFixture } from './helpers/clip-vector-fixture'

const files = (page: Page) => page.getByRole('listbox', { name: '出力ファイル' })
const tree = (page: Page) => page.getByTestId('layer-tree')
const menu = (page: Page) => page.getByRole('menu', { name: '選択した出力の操作' })
const more = (page: Page) => page.getByRole('button', { name: '出力一覧のメニュー' })
async function load(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  await page.getByRole('button', { name: '出力プレビュー', exact: true }).click()
  await expect(page.getByTestId('preview-file-name')).toHaveText('仮想セルテスト.jpg')
}
async function canvasClick(page: Page) {
  const box = (await page.getByTestId('output-view').boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + 20)
}

test('無効なボタンもマウスでは説明を表示できる', async ({ page }) => {
  await page.goto('./')
  const undo = page.getByRole('button', { name: '元に戻す', exact: true })
  await expect(undo).toBeDisabled()
  await undo.hover()
  await expect(page.getByRole('tooltip')).toHaveText('元に戻す (Ctrl+Z)')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
})

test('出力の操作は再クリック・Esc・外側フォーカス・スクロールで閉じ、選択と並べて表示を保つ', async ({ page }) => {
  await load(page)
  const first = files(page).getByRole('option', { name: 'B_1.jpg', exact: true })
  // Use an exposed row below the menu to exercise an actual outside click.
  const second = files(page).getByRole('option', { name: '_BG.jpg', exact: true })
  await first.click()
  await more(page).click(); await expect(menu(page)).toBeVisible()
  await more(page).click(); await expect(menu(page)).toHaveCount(0)
  await more(page).focus(); await page.keyboard.press('Enter')
  await more(page).focus(); await page.keyboard.press('Enter')
  await expect(menu(page)).toHaveCount(0)
  await more(page).click(); await page.keyboard.press('Escape')
  await expect(more(page)).toBeFocused()
  if (await page.getByRole('button', { name: '出力ファイル名を検索', exact: true }).isVisible()) await page.getByRole('button', { name: '出力ファイル名を検索', exact: true }).click()
  await more(page).click(); await page.getByRole('searchbox').focus()
  await expect(menu(page)).toHaveCount(0)
  await more(page).click(); await tree(page).evaluate(el => { el.scrollTop = el.scrollHeight })
  await expect(menu(page)).toHaveCount(0)
  await more(page).click(); await second.click({ modifiers: ['Control'] })
  await expect(menu(page)).toHaveCount(0)
  await expect(files(page).getByRole('option', { selected: true })).toHaveCount(2)
  await second.click({ button: 'right' })
  await expect(menu(page)).toContainText('2件を書き出し')
  await page.keyboard.press('Escape'); await expect(files(page)).toBeFocused()
  const names = await files(page).getByRole('option').allTextContents()
  await page.getByRole('button', { name: 'タイル表示', exact: true }).click()
  await expect(page.getByTestId('output-view').locator('canvas')).toHaveCount(2)
  expect(await files(page).getByRole('option').allTextContents()).toEqual(names)
})

test('アプリ・出力・設定・ファイル名のポップアップは再クリックとキャンバスクリックで閉じる', async ({ page }) => {
  await load(page)
  // Tile background clicks clear selection; use the single image to keep the
  // filename trigger available while checking each popup's dismissal behavior.
  await page.getByRole('button', { name: '１点表示', exact: true }).click()
  const cases = [
    { trigger: page.getByRole('button', { name: 'メニュー', exact: true }), popup: page.locator('#toolbar-app-menu') },
    { trigger: page.getByRole('button', { name: '出力', exact: true }), popup: page.getByRole('menu').filter({ has: page.getByRole('menuitem', { name: 'ZIP', exact: true }) }) },
    { trigger: page.getByRole('button', { name: '書き出し設定', exact: true }), popup: page.getByRole('dialog', { name: '書き出し設定', exact: true }) },
    { trigger: page.getByRole('button', { name: /^プレビュー中のファイル名/ }), popup: page.getByRole('dialog', { name: 'プレビュー中のファイル名', exact: true }) },
  ]
  for (const { trigger, popup } of cases) {
    await trigger.click(); await expect(popup).toBeVisible()
    await trigger.click(); await expect(popup).toHaveCount(0)
    await trigger.click(); await canvasClick(page); await expect(popup).toHaveCount(0)
    await trigger.click(); await page.keyboard.press('Escape'); await expect(popup).toHaveCount(0)
    await expect(trigger).toBeFocused()
  }
})

test('設定・色指定・ヘルプは背面へのTabとUndoを止め、Escで最前面だけ閉じてフォーカスを戻す', async ({ page }) => {
  await load(page)
  const memo = tree(page).locator('[data-layer-id]').filter({ has: page.getByText('memo', { exact: true }) })
  await more(page).click(); await memo.getByRole('button', { name: 'レイヤーを非表示にする' }).click()
  await expect(menu(page)).toHaveCount(0)
  const eye = memo.getByRole('button', { name: 'レイヤーを表示する' })
  await expect(eye).toHaveAttribute('aria-pressed', 'false')
  const settingsButton = page.getByRole('button', { name: '設定', exact: true })
  await settingsButton.click()
  const settings = page.getByRole('dialog', { name: '書き出し詳細設定', exact: true })
  await expect(settings).toBeVisible()
  expect(await settings.evaluate(el => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Control+z')
  await expect(eye).toHaveAttribute('aria-pressed', 'false')
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    expect(await settings.evaluate(el => el.contains(document.activeElement))).toBe(true)
  }
  const swatch = settings.getByRole('button', { name: /のフチ色を変更/ }).first()
  await swatch.click()
  const color = page.getByRole('dialog', { name: /のフチ色$/ })
  await expect(color).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(color).toHaveCount(0)
  await expect(settings).toBeVisible(); await expect(swatch).toBeFocused()
  await page.keyboard.press('Escape'); await expect(settings).toHaveCount(0)
  await expect(settingsButton).toBeFocused()
  await settingsButton.click(); await page.mouse.click(5, 5); await expect(settings).toHaveCount(0)
  const helpButton = page.getByRole('button', { name: 'ヘルプ', exact: true })
  await helpButton.click()
  const help = page.getByRole('dialog', { name: 'CSP Paperback ヘルプ' })
  await page.keyboard.press('Shift+Tab')
  expect(await help.evaluate(el => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape'); await expect(help).toHaveCount(0)
  await expect(helpButton).toBeFocused()
  await tree(page).focus(); await page.keyboard.press('Control+z')
  await expect(memo.getByRole('button', { name: 'レイヤーを非表示にする' })).toHaveAttribute('aria-pressed', 'true')
})

test('ツールチップはキーボードでも表示し、警告のポータルは親一覧を閉じずに操作できる', async ({ page }) => {
  await load(page)
  await page.getByRole('button', { name: '素材レイヤーのメニュー', exact: true }).focus()
  await page.keyboard.press('Enter')
  const reset = page.getByRole('menuitem', { name: '初期状態に戻す', exact: true })
  await reset.focus()
  const tip = page.getByRole('tooltip')
  await expect(tip).toContainText('すべての表示/非表示')
  await expect(reset).toHaveAttribute('aria-describedby', (await tip.getAttribute('id'))!)
  await page.keyboard.press('Escape'); await expect(tip).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.locator('button[title], span[title], div[title]')).toHaveCount(0)
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'c001.clip', mimeType: 'application/octet-stream', buffer: await clipVectorFixture() })
  await expect(page.getByTestId('tiled-preview')).toBeVisible()
  await page.getByRole('button', { name: '出力プレビュー', exact: true }).click()
  await expect(page.getByTestId('preview-files').getByRole('button', { name: /^描画の警告/ })).toBeVisible()
  await page.getByRole('button', { name: /^プレビュー中のファイル名/ }).click()
  const names = page.getByRole('dialog', { name: 'プレビュー中のファイル名', exact: true })
  const warning = names.getByRole('button', { name: /^描画の警告/ }).first()
  const details = page.getByRole('dialog', { name: '描画の警告', exact: true })
  await warning.click(); await expect(details).toBeVisible()
  await warning.click(); await expect(details).toHaveCount(0)
  await warning.click(); await expect(details).toBeVisible()
  await details.getByText(/近似描画/).first().click(); await expect(names).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(details).toHaveCount(0); await expect(names).toBeVisible()
  await page.keyboard.press('Escape'); await expect(names).toHaveCount(0)
})

for (const viewport of [{ width: 960, height: 640 }, { width: 1280, height: 820 }]) {
  test(`合成元の一覧は開閉ボタンに重ならず再クリックで閉じる ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await load(page)
    await files(page).getByRole('option', { name: 'B_1_s.jpg', exact: true }).click()
    await tree(page).evaluate(element => { element.scrollTop = element.scrollHeight })
    const trigger = page.locator('[data-connection-kind="sources"][data-connection-edge="above"]')
    await trigger.click()
    const popup = page.getByRole('dialog', { name: '画面外の合成元' })
    await expect(popup).toBeVisible()
    const a = (await trigger.boundingBox())!, b = (await popup.boundingBox())!
    expect(b.y + b.height <= a.y || b.y >= a.y + a.height).toBe(true)
    await trigger.click(); await expect(popup).toHaveCount(0)
  })
}
