import { readFile } from 'node:fs/promises'
import initSqlJs from 'sql.js'
import { openDocument } from 'celcodec'
import { unzipSync } from 'fflate'
import { expect, test, type Page } from './fixtures'
import { sessionFixture, sessionIds } from '../src/test/fixtures/clip-session'

const ids = ['55555555555555555555555555555555', '66666666666666666666666666666666', '77777777777777777777777777777777']
const secondTimeline = '88888888888888888888888888888888'

async function fixture(multiple: boolean) {
  const SQL = await initSqlJs()
  const bytes = await sessionFixture(SQL, ids.map((id, index) => ({ type: 'addLayer' as const,
    id, parentId: sessionIds.folder, kind: 'raster' as const, name: String(index + 2),
    pixels: { width: 1, height: 1, channels: 4 as const, data: new Uint8Array([0, 0, 255, 255]) }, left: index + 4, top: 5,
  })))
  const session = openDocument(SQL, bytes)
  try {
    const first = session.document.timelines.find(t => t.id === sessionIds.timeline)!
    const plan = await session.planEdits([
      { type: 'setCelKeys', timelineId: first.id, layerId: sessionIds.folder,
        keys: [{ frame: 0, value: '1' }, { frame: 3, value: '2' }] },
      ...(multiple ? [
        { type: 'duplicateTimeline' as const, timelineId: first.id, id: secondTimeline, name: 'second' },
        { type: 'setCelKeys' as const, timelineId: secondTimeline, layerId: sessionIds.folder,
          keys: [{ frame: 0, value: '2' }, { frame: 3, value: '1' }, { frame: 6, value: '3' }] },
      ] : []),
    ])
    if (!plan.allowed) throw new Error(JSON.stringify(plan.diagnostics))
    return Buffer.from((await session.save(plan)).bytes)
  } finally { session.dispose() }
}

const list = (page: Page) => page.getByRole('listbox', { name: '出力ファイル', exact: true })
async function outputNames(page: Page) {
  return (await list(page).getByRole('option').evaluateAll(rows => rows.map(row => row.getAttribute('aria-label')))).sort()
}
async function downloadNames(page: Page) {
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: '出力', exact: true }).click()
  const download = await downloading
  return Object.keys(unzipSync(new Uint8Array(await readFile((await download.path())!))))
    .filter(name => /\.(jpg|png)$/.test(name)).map(name => name.split('/').at(-1)).sort()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined })
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined })
    localStorage.setItem('csp-paperback:settings', JSON.stringify({ version: 2,
      state: { projectSettings: { sharedCutMode: true, cellNamingMode: 'sheet-sequence' } } }))
  })
})

test('単一タイムラインでは兼用ONを適用せず、未使用セルの目を開いても一覧とZIPから除外する', async ({ page }) => {
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'single.clip', mimeType: 'application/octet-stream', buffer: await fixture(false) })
  await expect(list(page).getByRole('option')).toHaveCount(2)
  const before = await outputNames(page)
  expect(before).toEqual(['A_1.jpg', 'A_2.jpg'])
  const tree = page.getByTestId('layer-tree')
  const expand = tree.getByRole('button', { name: 'Aを展開する', exact: true })
  if (await expand.count()) await expand.click()
  const unused = tree.locator(`[data-layer-id="clip:${ids[2]}"] button[data-layer-column="visibility"]`)
  await expect(unused).toHaveAttribute('aria-pressed', 'false')
  await unused.click()
  await expect(unused).toHaveAttribute('aria-pressed', 'true')
  expect(await outputNames(page)).toEqual(before)
  expect(await downloadNames(page)).toEqual(before)
})

test('兼用は全タイムラインの使用セルを出力し、切り替えても最初のタイムラインの番号を保持する', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'shared.clip', mimeType: 'application/octet-stream', buffer: await fixture(true) })
  await expect(list(page).getByRole('option')).toHaveCount(3)
  const before = await outputNames(page)
  expect(before).toEqual(['A_1.jpg', 'A_2.jpg', 'A_3.jpg'])
  const identities = await list(page).getByRole('option').evaluateAll(rows => rows.map(row => [row.getAttribute('data-output-source-id'), row.getAttribute('aria-label')]))
  await page.getByRole('button', { name: 'キャンバス', exact: true }).click()
  await page.getByRole('combobox', { name: 'タイムライン', exact: true }).selectOption({ label: 'second' })
  expect(await list(page).getByRole('option').evaluateAll(rows => rows.map(row => [row.getAttribute('data-output-source-id'), row.getAttribute('aria-label')]))).toEqual(identities)
  expect(await downloadNames(page)).toEqual(before)
  expect(errors).toEqual([])
})
