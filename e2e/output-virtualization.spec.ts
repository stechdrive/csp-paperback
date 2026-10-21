import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'
import { manyOutputs } from './helpers/many-outputs'

const list = (page: Page) => page.getByRole('listbox', { name: '出力ファイル' })
const active = (page: Page) => list(page).locator('[data-active-output="true"]')
const search = (page: Page) => page.getByRole('searchbox', { name: '出力ファイル名を検索' })

async function load(page: Page, count: number, folder = 'A') {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined })
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined })
  })
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles(manyOutputs(count, folder))
  await expect(page.getByText(`${count}件`, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '出力ファイル名を検索', exact: true }).click()
  await page.getByRole('button', { name: '出力プレビュー', exact: true }).click()
}

async function expectActiveVisible(page: Page) {
  await expect.poll(() => active(page).evaluate(row => {
    const a = row.getBoundingClientRect(), b = row.closest('[role=listbox]')!.getBoundingClientRect()
    return a.top < b.bottom && a.bottom > b.top
  })).toBe(true)
  const id = await list(page).getAttribute('aria-activedescendant')
  await expect(active(page)).toHaveAttribute('id', id!)
}

test('1200件の画面外を含む検索・範囲選択・キー移動・接続線・選択書き出しを保つ', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 })
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await load(page, 1200)
  const rows = list(page).getByRole('option')
  await expect.poll(() => rows.count()).toBeLessThan(40)
  await list(page).press('Home')
  await expect(active(page)).toHaveAttribute('aria-posinset', '1')
  await expect(active(page)).toHaveAttribute('aria-setsize', '1200')
  const first = (await active(page).textContent())!
  await list(page).press('Shift+End')
  await expectActiveVisible(page)
  await expect(page.getByText('1200選択', { exact: true })).toBeVisible()
  await expect(active(page)).toHaveAttribute('aria-posinset', '1200')
  const last = (await active(page).textContent())!
  await list(page).press('ArrowUp')
  await expect(active(page)).toHaveAttribute('aria-posinset', '1199')
  await list(page).dispatchEvent('wheel', { deltaY: 100, shiftKey: true })
  await expect(active(page)).toHaveAttribute('aria-posinset', '1200')
  await list(page).dispatchEvent('keydown', { key: 'Home', isComposing: true })
  await expect(active(page)).toHaveAttribute('aria-posinset', '1200')
  // The active option stays a real accessible row when scrolled out of view.
  await list(page).dispatchEvent('wheel', { deltaY: -1 })
  await list(page).evaluate(el => { el.scrollTop = 0 })
  await expect(page.getByRole('button', { name: '選択中の出力へ戻る' })).toBeVisible()
  await expect(rows).not.toHaveCount(1200)
  await expect(active(page)).toHaveCount(1)
  await page.getByRole('button', { name: '選択中の出力へ戻る' }).click()
  await expectActiveVisible(page)
  await expect(page.getByRole('button', { name: '選択中の出力へ戻る' })).toHaveCount(0)
  await expect(page.getByTestId('output-connections').locator('path').first()).toBeVisible()
  // Clicking across unmounted rows must use the full ordered list as the range.
  await list(page).press('Home')
  await list(page).dispatchEvent('wheel', { deltaY: 1 })
  await list(page).evaluate(el => { el.scrollTop = el.scrollHeight })
  await list(page).getByRole('option', { name: last, exact: true }).click({ modifiers: ['Shift'] })
  await expect(page.getByText('1200選択', { exact: true })).toBeVisible()
  await search(page).fill('Ａ＿１９') // NFKC and case folding still search every item.
  await expect(page.getByText('1200選択（一覧外1189）', { exact: true })).toBeVisible()
  await list(page).press('Control+a')
  await expect(page.getByText('11選択', { exact: true })).toBeVisible()
  await list(page).press('End')
  await expect(active(page)).toHaveAttribute('aria-posinset', '11')
  await search(page).fill('no-such-output')
  await expect(rows).toHaveCount(0)
  await expect(page.getByTestId('output-connections').locator('path')).toHaveCount(0)
  await expect(list(page)).not.toHaveAttribute('aria-activedescendant')
  await search(page).fill('')
  await list(page).press('Home')
  await expect(active(page)).toHaveText(first)
  await list(page).dispatchEvent('wheel', { deltaY: 1 })
  await list(page).evaluate(el => { el.scrollTop = el.scrollHeight })
  await list(page).getByRole('option', { name: last, exact: true }).click({ modifiers: ['Control'] })
  await expect(page.getByText('2選択', { exact: true })).toBeVisible()
  await list(page).press('Shift+F10')
  const menu = page.getByRole('menu', { name: '選択した出力の操作' })
  await expect(menu).toContainText('2件を書き出し')
  const download = page.waitForEvent('download')
  await menu.getByRole('menuitem', { name: '選択項目をZIPに書き出し' }).click()
  const outputs = unzipSync(await readFile((await (await download).path())!))
  expect(Object.keys(outputs).sort()).toEqual([first, last].sort())
  expect(errors).toEqual([])
})

test('折り返す長い名前と未配置セルの高さを測り、リサイズと検索後も行を重ねない', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 })
  // Wrap across several lines without exceeding the 255-byte filename limit.
  const folder = '長い素材名と工程名を省略せずに確認するためのアニメーションフォルダ'.repeat(3).slice(0, 80)
  await load(page, 180, folder)
  const checkRows = async () => {
    await expect.poll(() => list(page).evaluate(el => {
      const rows = [...el.querySelectorAll<HTMLElement>('[data-virtual-row]')].map(row => ({ index: Number(row.dataset.virtualRow), rect: row.getBoundingClientRect() }))
      return rows.every((row, i) => i === 0 || row.index !== rows[i - 1].index + 1 || Math.abs(row.rect.top - rows[i - 1].rect.bottom) < 1)
    })).toBe(true)
  }
  await list(page).press('End'); await expectActiveVisible(page); await checkRows()
  await expect(active(page)).toContainText(folder)
  expect((await active(page).boundingBox())!.height).toBeGreaterThan(57)
  for (const width of [960, 1400, 800, 1280]) {
    await page.setViewportSize({ width, height: 820 })
    await expectActiveVisible(page); await checkRows()
  }
  for (const fraction of [0.25, 0.5, 0.75]) {
    // User scrolling cancels the resize/keyboard reveal still settling above.
    await list(page).dispatchEvent('wheel', { deltaY: -1 })
    await list(page).evaluate((el, fraction) => { el.scrollTop = el.scrollHeight * fraction }, fraction)
    await checkRows()
    await page.getByRole('button', { name: '選択中の出力へ戻る' }).click()
    await expectActiveVisible(page); await checkRows()
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '20px' })
  await checkRows()
  await list(page).press('Home'); await expectActiveVisible(page); await checkRows()
  await page.evaluate(() => { document.documentElement.style.fontSize = '' })
  // Search changes the logical indices; cached heights cannot follow old indices.
  await search(page).fill('_1.jpg'); await checkRows()
  await expect(list(page).getByRole('option')).toHaveCount(1)
  await search(page).fill(''); await list(page).press('End'); await checkRows()
  await page.getByRole('button', { name: '仮想セル', exact: true }).click()
  const panel = page.getByTestId('virtual-panel')
  await panel.getByRole('button', { name: /追加/ }).click()
  const item = panel.locator('[class*="_item_"]').last()
  await item.getByRole('textbox').fill('未配置の確認用')
  await page.getByRole('button', { name: '選択中の出力をツリーで表示' }).click()
  const sourceId = await active(page).getAttribute('data-output-source-id')
  const source = page.getByTestId('layer-tree').locator(`[data-layer-id="${sourceId}"]`)
  await source.dragTo(item.getByText('レイヤーをドロップ', { exact: true }))
  await list(page).press('End')
  await expect(active(page)).toHaveText('未配置の確認用')
  await expect(list(page)).toContainText('未配置の仮想セル · 書き出し対象外')
  await expectActiveVisible(page); await checkRows()
  await search(page).fill('未配置'); await checkRows()
  await expect(active(page)).toHaveAttribute('aria-setsize', '1')
})
