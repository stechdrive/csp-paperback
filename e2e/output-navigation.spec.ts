import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'
import initSqlJs from 'sql.js'

const sampleOutputs = [
  '仮想セルテスト.jpg', '_PAN.jpg', '_SL.jpg', 'A_1_e.jpg',
  'B_1.jpg', 'B_1_s.jpg', 'A_1.jpg', '_BOOK1.jpg', '_BG.jpg',
]

const sampleLayers = {
  memo: '249600da7c794ec395eaf72ba5ff0ef4',
  instructions: '8c618eb280784aaf85866a4ce20bab13',
  pan: '7fcfa28a18f042f7a7e447250c4b243f',
  panContent: '615b1b081a75405eb1c918db6383fc86',
  sl: '1932804ac72a4800825beae93ab9dac7',
  layout: 'f7785312d3c74c9586ad91ae220c4142',
  animationB: 'e568d7c9360948f89842a4125edaf9b2',
  bodyB: '8153c34b3f3b4003bf3c435c415681d2',
  processB: 'ab0c91cb214e4f96919f430496b3fa9d',
  processInkB: '5b81aa2c782c435a934ad070045c37ad',
  bodyInkB: '62f1cb2562484b7ab33e6e7a11487b6c',
  revisionA: '86a4f4dae1b14f90a85ed73c1116bc9e',
  animationA: '0bbf0eebbc2641178ef768cc7f705db4',
  bodyA: '8b2ec2223a2d4aa0b74e84333d2cada8',
  bodyInkA: '893251694d3d4883bc9db6519660428b',
  book: 'e0ca676acbeb4e808cc7535ae1054717',
} as const

type SampleLayer = keyof typeof sampleLayers
function row(page: Page, name: SampleLayer) {
  return page.getByTestId('layer-tree').locator(`[data-layer-id="clip:${sampleLayers[name]}"]`)
}
function expansion(layer: Locator) {
  return layer.locator('button[aria-expanded]')
}
function visibility(layer: Locator) {
  return layer.locator('button[aria-pressed]')
}

/** Change saved folder visibility or expansion; keep the sample's artwork and hierarchy. */
async function closedSample(hideInstructions = false) {
  const bytes = await readFile('public/sample/c001.clip')
  const SQL = await initSqlJs()
  for (let offset = 24; offset < bytes.length;) {
    const end = offset + 16 + Number(bytes.readBigUInt64BE(offset + 8))
    if (bytes.toString('ascii', offset, offset + 8) === 'CHNKSQLi') {
      const db = new SQL.Database(bytes.subarray(offset + 16, end))
      try {
        if (hideInstructions) {
          db.run("UPDATE Layer SET LayerVisibility = 0 WHERE LayerName = '_撮影指示'")
        } else {
          db.run('UPDATE Layer SET LayerFolder = LayerFolder | 16 WHERE (LayerFolder & 1) = 1')
        }
        const database = Buffer.from(db.export())
        const header = Buffer.from(bytes.subarray(offset, offset + 16))
        header.writeBigUInt64BE(BigInt(database.length), 8)
        return Buffer.concat([bytes.subarray(0, offset), header, database, bytes.subarray(end)])
      } finally {
        db.close()
      }
    }
    offset = end
  }
  throw new Error('Sample CLIP has no SQLite chunk')
}

async function loadSample(page: Page, collapsed = false) {
  if (collapsed) {
    const body = await closedSample()
    await page.route('**/sample/c001.clip', route => route.fulfill({ body, contentType: 'application/octet-stream' }))
  }
  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  await expect(previewNames(page)).toHaveText([sampleOutputs[0]], { timeout: 30000 })
}

async function expectSelectedOutput(page: Page, name: SampleLayer, imageName: string) {
  const selected = row(page, name)
  await expect(previewNames(page)).toHaveText([imageName])
  await expect(selected).toHaveClass(/_rowSelected_/)
  await expect(selected).toBeVisible()
  await expect.poll(async () => {
    const layer = await selected.boundingBox(), tree = await page.getByTestId('layer-tree').boundingBox()
    if (!layer || !tree) return false
    const middle = layer.y + layer.height / 2
    return middle >= tree.y && middle <= tree.y + tree.height
  }).toBe(true)
}

/** Read the actual archive directory; this expectation is independent of navigation code. */
function zipImageNames(bytes: Buffer): string[] {
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  expect(end).toBeGreaterThanOrEqual(0)
  let count = bytes.readUInt16LE(end + 10)
  let offset = bytes.readUInt32LE(end + 16)
  if (count === 0xffff || offset === 0xffffffff) {
    expect(bytes.readUInt32LE(end - 20)).toBe(0x07064b50)
    const zip64 = Number(bytes.readBigUInt64LE(end - 12))
    expect(bytes.readUInt32LE(zip64)).toBe(0x06064b50)
    count = Number(bytes.readBigUInt64LE(zip64 + 32))
    offset = Number(bytes.readBigUInt64LE(zip64 + 48))
  }
  const names: string[] = []
  for (let index = 0; index < count; index++) {
    expect(bytes.readUInt32LE(offset)).toBe(0x02014b50)
    const length = bytes.readUInt16LE(offset + 28)
    names.push(bytes.toString('utf8', offset + 46, offset + 46 + length))
    offset += 46 + length + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32)
  }
  return names.filter(name => /\.(jpg|png)$/i.test(name))
}

async function exportedImageNames(page: Page) {
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: '出力', exact: true }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('c001.zip')
  return zipImageNames(await readFile((await download.path())!))
}

function previewNames(page: Page) {
  return page.getByTestId('preview-file-name')
}

async function previewPixelHash(page: Page) {
  return page.getByTestId('output-view').locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    let hash = 2166136261
    for (const value of pixels) hash = Math.imul(hash ^ value, 16777619)
    return (hash >>> 0).toString(16)
  })
}

async function wheel(page: Page, delta: number, shift = true) {
  await page.getByTestId('layer-tree').hover({ position: { x: 10, y: 20 } })
  if (shift) await page.keyboard.down('Shift')
  await page.mouse.wheel(0, delta)
  if (shift) await page.keyboard.up('Shift')
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}

async function walkOutputs(page: Page, expected: string[]) {
  await expect(previewNames(page)).toHaveText([expected[0]])
  for (const name of expected.slice(1)) {
    // A large wheel delta must still advance by exactly one final image.
    await wheel(page, 700)
    await expect(previewNames(page)).toHaveText([name])
    await expect(page.getByTestId('output-view').locator('canvas')).toHaveCount(1)
  }
  await wheel(page, 700)
  await expect(previewNames(page)).toHaveText([expected.at(-1)!])
  for (const name of expected.slice(0, -1).reverse()) {
    await wheel(page, -700)
    await expect(previewNames(page)).toHaveText([name])
  }
  await wheel(page, -700)
  await expect(previewNames(page)).toHaveText([expected[0]])
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined })
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined })
  })
  await page.goto('./')
})

test('出力一覧は実ZIPと一致し、検索・選択・ツリー復帰・表示設定に同期する', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 960, height: 640 })
  await loadSample(page, true)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const navigator = page.getByTestId('navigator-panel')
  const navigatorBefore = await navigator.boundingBox()
  const viewport = await navigator.locator('[class*="_navigatorViewport_"]').boundingBox()
  expect(viewport!.height).toBeGreaterThan(navigatorBefore!.height * 0.7)
  await expect(navigator.getByText('全体ナビゲーター', { exact: true })).toHaveCount(0)
  await expect(navigator.getByRole('button', { name: '全体ナビゲーターを中央で大きく表示' })).toHaveCount(0)
  await expect(navigator.getByRole('slider')).toBeVisible()
  const seekHeight = (await navigator.getByTestId('timeline-seek-bar').boundingBox())!.height
  expect(seekHeight).toBeGreaterThanOrEqual(24)
  expect(seekHeight).toBeLessThanOrEqual(28)

  // Keep a manually opened branch while exploring a different branch in the list.
  await expansion(row(page, 'instructions')).click()
  const mode = page.getByRole('group', { name: 'レイヤーパネルの表示' })
  await mode.getByRole('button', { name: '出力一覧', exact: true }).click()
  const files = page.getByRole('listbox', { name: '出力ファイル' })
  await expect(files.getByRole('option')).toHaveText(sampleOutputs)
  expect((await exportedImageNames(page)).sort()).toEqual((await files.getByRole('option').allTextContents()).sort())
  expect(await navigator.boundingBox()).toEqual(navigatorBefore)

  await page.getByRole('button', { name: '全体ナビゲーター', exact: true }).click()
  await files.getByRole('option', { name: 'B_1.jpg', exact: true }).click()
  await expect(previewNames(page)).toHaveText(['B_1.jpg'])
  await expect(page.getByTestId('output-view')).toBeVisible()
  await files.hover()
  await page.keyboard.down('Shift')
  await page.mouse.wheel(0, 700)
  await page.keyboard.up('Shift')
  await expect(previewNames(page)).toHaveText(['B_1_s.jpg'])
  await expect(files.getByRole('option', { selected: true })).toHaveText('B_1_s.jpg')
  const search = page.getByRole('searchbox', { name: '出力ファイル名を検索' })
  await search.fill('_1_s')
  await expect(files.getByRole('option')).toHaveText(['B_1_s.jpg'])
  await files.focus()
  await page.keyboard.press('ArrowDown')
  await expect(previewNames(page)).toHaveText(['B_1_s.jpg'])
  await search.fill('')
  await page.screenshot({ path: testInfo.outputPath('output-list-960.png') })
  await page.getByRole('button', { name: '選択中の出力をツリーで表示' }).click()
  await expectSelectedOutput(page, 'processB', 'B_1_s.jpg')
  await expect(expansion(row(page, 'instructions'))).toHaveAttribute('aria-expanded', 'true')
  await visibility(row(page, 'processB')).click()
  await mode.getByRole('button', { name: '出力一覧', exact: true }).click()
  await expect(files.getByRole('option')).toHaveCount(8)
  await expect(files.getByRole('option', { selected: true })).toHaveCount(0)
  await expect(previewNames(page)).toHaveCount(0)
  await page.keyboard.press('Control+z')
  await expect(files.getByRole('option', { selected: true })).toHaveText('B_1_s.jpg')

  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  const settings = page.getByRole('dialog', { name: '書き出し設定', exact: true })
  await settings.getByRole('button', { name: 'PNG', exact: true }).click()
  await settings.getByRole('switch', { name: 'フォルダ分け', exact: true }).click()
  await settings.getByRole('button', { name: '演出', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(files.getByRole('option')).toHaveCount(8)
  await expect(files.getByRole('option', { selected: true })).toHaveText('B/B_1_s.png')
  await expect(previewNames(page)).toHaveText(['B/B_1_s.png'])
  expect((await exportedImageNames(page)).sort()).toEqual((await files.getByRole('option').allTextContents()).sort())
  expect(await navigator.boundingBox()).toEqual(navigatorBefore)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('Shift+ホイールは実ZIPの画像を1枚ずつ巡回し、本体と工程を分け、通常ホイールは選択を変えない', async ({ page }) => {
  await loadSample(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  expect((await exportedImageNames(page)).sort()).toEqual([...sampleOutputs].sort())

  await wheel(page, 700)
  await expect(previewNames(page)).toHaveText(['_PAN.jpg'])
  const selected = page.getByTestId('layer-tree').locator('[data-layer-id][class*="_rowSelected_"]')
  const selectedId = await selected.getAttribute('data-layer-id')
  await wheel(page, 300, false)
  await expect(selected).toHaveAttribute('data-layer-id', selectedId!)
  await expect(previewNames(page)).toHaveText(['_PAN.jpg'])
  await wheel(page, -700)

  // B_1 and B_1_s are adjacent distinct images, never a combined two-image stop.
  await walkOutputs(page, sampleOutputs)
  expect(errors).toEqual([])
})

test('工程と個別素材を出力対象から外すとShift巡回も実ZIPと同じ対象へ絞られる', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  const settings = page.getByRole('dialog', { name: '書き出し設定', exact: true })
  for (const name of ['演出', '作監', 'PAN 個別書き出し', 'SL 個別書き出し', 'BG 個別書き出し', 'BOOK1 個別書き出し']) {
    const toggle = settings.getByRole('button', { name, exact: true })
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  }
  await page.keyboard.press('Escape')
  const included = ['仮想セルテスト.jpg', 'B_1.jpg', 'A_1.jpg']
  expect((await exportedImageNames(page)).sort()).toEqual([...included].sort())
  await walkOutputs(page, included)
})

test('作画本体をOFFにしても目玉と修正を保持し、状態表示と実ZIPが一致する', async ({ page }, testInfo) => {
  await loadSample(page)
  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  const settings = page.getByRole('dialog', { name: '書き出し設定', exact: true })
  await expect(settings.getByRole('button', { name: '監督', exact: true })).toHaveCount(0)
  const body = settings.getByRole('button', { name: '作画', exact: true })
  await body.click()
  await expect(body).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Escape')
  await expect(visibility(row(page, 'animationB'))).toHaveAttribute('aria-pressed', 'true')
  await expect(row(page, 'animationB').locator('[data-output-state="partial"]')).toHaveText('一部OFF')
  const included = sampleOutputs.filter(name => !['A_1.jpg', 'B_1.jpg'].includes(name))
  expect((await exportedImageNames(page)).sort()).toEqual([...included].sort())
  await walkOutputs(page, included)
  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  await expect(settings.getByRole('button', { name: '作画', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.screenshot({ path: testInfo.outputPath('output-targets.png') })
})

test('非表示の個別対象は読み込み設定に従って目玉をONにし、設定OFFなら元の表示を保つ', async ({ page }) => {
  const body = await closedSample(true)
  await page.route('**/sample/c001.clip', route => route.fulfill({ body, contentType: 'application/octet-stream' }))
  await loadSample(page)
  await expect(visibility(row(page, 'instructions'))).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '設定', exact: true }).click()
  const toggle = page.getByRole('checkbox', { name: '対象フォルダを非表示でも表示して読み込む', exact: true })
  await toggle.uncheck()
  await expect(visibility(row(page, 'instructions'))).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await loadSample(page)
  await expect(visibility(row(page, 'instructions'))).toHaveAttribute('aria-pressed', 'false')
  expect(await exportedImageNames(page)).not.toContain('_PAN.jpg')
})

test('初期状態で閉じた階層は出力行まで一時展開し、巡回で離れると元に戻る', async ({ page }) => {
  await loadSample(page, true)
  await expect(expansion(row(page, 'instructions'))).toHaveAttribute('aria-expanded', 'false')
  await expect(expansion(row(page, 'layout'))).toHaveAttribute('aria-expanded', 'false')
  await expect(row(page, 'pan')).toHaveCount(0)

  await wheel(page, 120)
  await expectSelectedOutput(page, 'pan', '_PAN.jpg')
  await expect(expansion(row(page, 'instructions'))).toHaveAttribute('aria-expanded', 'true')
  await expect(expansion(row(page, 'pan'))).toHaveAttribute('aria-expanded', 'false')
  await expect(row(page, 'panContent')).toHaveCount(0)
  await wheel(page, 120)
  await expectSelectedOutput(page, 'sl', '_SL.jpg')
  await wheel(page, 120)
  await expectSelectedOutput(page, 'revisionA', 'A_1_e.jpg')
  await expect(expansion(row(page, 'instructions'))).toHaveAttribute('aria-expanded', 'false')
  await expect(expansion(row(page, 'revisionA'))).toHaveAttribute('aria-expanded', 'false')

  await wheel(page, 120)
  await expectSelectedOutput(page, 'bodyB', 'B_1.jpg')
  await expect(expansion(row(page, 'bodyB'))).toHaveAttribute('aria-expanded', 'true')
  await expect(row(page, 'processB')).toBeVisible()
  await expect(expansion(row(page, 'processB'))).toHaveAttribute('aria-expanded', 'false')
  await wheel(page, 120)
  await expectSelectedOutput(page, 'processB', 'B_1_s.jpg')
  await expect(row(page, 'processInkB')).toHaveCount(0)
  await wheel(page, 120)
  await expectSelectedOutput(page, 'bodyA', 'A_1.jpg')
  await expect(expansion(row(page, 'animationB'))).toHaveAttribute('aria-expanded', 'false')
  await expect(row(page, 'bodyB')).toHaveCount(0)
  await wheel(page, 120)
  await expectSelectedOutput(page, 'book', '_BOOK1.jpg')
  await expect(expansion(row(page, 'layout'))).toHaveAttribute('aria-expanded', 'false')
  await wheel(page, -120)
  await expectSelectedOutput(page, 'bodyA', 'A_1.jpg')
  await wheel(page, -120)
  await expectSelectedOutput(page, 'processB', 'B_1_s.jpg')
})

test('手動で開いた階層は保持し、手動で閉じた階層も次の巡回中だけ展開する', async ({ page }) => {
  await loadSample(page, true)
  const instructions = expansion(row(page, 'instructions'))
  await instructions.click()
  await expect(instructions).toHaveAttribute('aria-expanded', 'true')
  await wheel(page, 120)
  await expectSelectedOutput(page, 'pan', '_PAN.jpg')
  await wheel(page, 120)
  await expectSelectedOutput(page, 'sl', '_SL.jpg')
  await wheel(page, 120)
  await expectSelectedOutput(page, 'revisionA', 'A_1_e.jpg')
  await expect(instructions).toHaveAttribute('aria-expanded', 'true')

  await instructions.click()
  await expect(instructions).toHaveAttribute('aria-expanded', 'false')
  await wheel(page, -120)
  await expectSelectedOutput(page, 'sl', '_SL.jpg')
  await expect(instructions).toHaveAttribute('aria-expanded', 'true')
  await wheel(page, -120)
  await expectSelectedOutput(page, 'pan', '_PAN.jpg')
  await wheel(page, -120)
  await expect(previewNames(page)).toHaveText(['仮想セルテスト.jpg'])
  await expect(instructions).toHaveAttribute('aria-expanded', 'false')

  await wheel(page, 120)
  await expectSelectedOutput(page, 'pan', '_PAN.jpg')
  await instructions.click()
  await expect(instructions).toHaveAttribute('aria-expanded', 'false')
  await expect(row(page, 'pan')).toHaveCount(0)
  await expect(previewNames(page)).toHaveText(['_PAN.jpg'])
  await wheel(page, 120)
  await expectSelectedOutput(page, 'sl', '_SL.jpg')
  await wheel(page, 120)
  await expectSelectedOutput(page, 'revisionA', 'A_1_e.jpg')
  await expect(instructions).toHaveAttribute('aria-expanded', 'false')
})

test('一時展開中の通常選択と目の操作は選択を奪わず、内部レイヤーの出力へ同期する', async ({ page }) => {
  await loadSample(page, true)
  // A normal click must clear the sample's virtual-cell selection and old preview focus.
  await row(page, 'memo').getByTitle('memo', { exact: true }).click()
  await expect(row(page, 'memo')).toHaveClass(/_rowSelected_/)
  await expect(previewNames(page)).toHaveCount(0)
  await wheel(page, 120)
  await expect(previewNames(page)).toHaveText(['仮想セルテスト.jpg'])
  for (const name of sampleOutputs.slice(1, 5)) {
    await wheel(page, 120)
    await expect(previewNames(page)).toHaveText([name])
  }
  await expectSelectedOutput(page, 'bodyB', 'B_1.jpg')
  const process = row(page, 'processB')
  await expansion(process).click()
  await expect(expansion(process)).toHaveAttribute('aria-expanded', 'true')
  await process.getByTitle('_s', { exact: true }).click()
  await expectSelectedOutput(page, 'processB', 'B_1_s.jpg')
  const processInk = row(page, 'processInkB')
  await processInk.locator('span[title]').click()
  await expectSelectedOutput(page, 'processInkB', 'B_1_s.jpg')

  // Clicking a different row's eye must not select that row through event bubbling.
  const bodyInk = row(page, 'bodyInkB')
  await visibility(bodyInk).click()
  await expect(visibility(bodyInk)).toHaveAttribute('aria-pressed', 'false')
  await expectSelectedOutput(page, 'processInkB', 'B_1_s.jpg')
  await expect(bodyInk).not.toHaveClass(/_rowSelected_/)
  // Hiding the selected content layer must not collapse away its selected row.
  const visiblePixels = await previewPixelHash(page)
  await visibility(processInk).click()
  await expect(visibility(processInk)).toHaveAttribute('aria-pressed', 'false')
  await expectSelectedOutput(page, 'processInkB', 'B_1_s.jpg')
  await expect.poll(() => previewPixelHash(page)).not.toBe(visiblePixels)
  await visibility(processInk).click()
  await expect(visibility(processInk)).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => previewPixelHash(page)).toBe(visiblePixels)
  await visibility(bodyInk).click()
  await bodyInk.locator('span[title]').click()
  await expectSelectedOutput(page, 'bodyInkB', 'B_1.jpg')

  await wheel(page, 120)
  await expectSelectedOutput(page, 'processB', 'B_1_s.jpg')
  await wheel(page, 120)
  await expectSelectedOutput(page, 'bodyA', 'A_1.jpg')
  await wheel(page, -120)
  await expectSelectedOutput(page, 'processB', 'B_1_s.jpg')
  await expect(expansion(process)).toHaveAttribute('aria-expanded', 'true')
  await expect(processInk).toBeVisible()
  // A normal content click in another cell must replace the previous process focus.
  await expansion(row(page, 'animationA')).click()
  await expansion(row(page, 'bodyA')).click()
  await row(page, 'bodyInkA').locator('span[title]').click()
  await expectSelectedOutput(page, 'bodyInkA', 'A_1.jpg')
  await row(page, 'memo').getByTitle('memo', { exact: true }).click()
  await expect(row(page, 'memo')).toHaveClass(/_rowSelected_/)
  await expect(previewNames(page)).toHaveCount(0)
  await expect(expansion(row(page, 'layout'))).toHaveAttribute('aria-expanded', 'false')
})

test('非表示工程とその内部を選んでも別の出力へ切り替わらず、再表示で工程の画像へ戻る', async ({ page }) => {
  await loadSample(page, true)
  for (const name of sampleOutputs.slice(1, 5)) {
    await wheel(page, 120)
    await expect(previewNames(page)).toHaveText([name])
  }
  await expectSelectedOutput(page, 'bodyB', 'B_1.jpg')
  const process = row(page, 'processB')
  const processInk = row(page, 'processInkB')
  await expansion(process).click()
  await visibility(process).click()
  await expect(visibility(process)).toHaveAttribute('aria-pressed', 'false')
  await expectSelectedOutput(page, 'bodyB', 'B_1.jpg')

  // Both the hidden output folder and its artwork still belong to the same output.
  // Selecting either must not fall back to the cell's visible body image.
  for (const selected of [process, processInk]) {
    await selected.locator('span[title]').click()
    await expect(selected).toHaveClass(/_rowSelected_/)
    await expect(selected).toBeVisible()
    await expect(previewNames(page)).toHaveCount(0)
    await expect(page.getByTestId('output-view').locator('canvas')).toHaveCount(0)
    await visibility(process).click()
    await expect(visibility(process)).toHaveAttribute('aria-pressed', 'true')
    await expect(previewNames(page)).toHaveText(['B_1_s.jpg'])
    await expect(page.getByTestId('output-view').locator('canvas')).toHaveCount(1)
    await expect(selected).toHaveClass(/_rowSelected_/)
    await visibility(process).click()
    await expect(visibility(process)).toHaveAttribute('aria-pressed', 'false')
    await expect(previewNames(page)).toHaveCount(0)
  }
})
