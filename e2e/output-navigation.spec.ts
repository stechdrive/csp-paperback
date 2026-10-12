import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const sampleOutputs = [
  '仮想セルテスト.jpg', '_PAN.jpg', '_SL.jpg', 'A_1_e.jpg',
  'B_1.jpg', 'B_1_s.jpg', 'A_1.jpg', '_BOOK1.jpg', '_BG.jpg',
]

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
  return page.getByTestId('output-view').locator('[class*="_fileName_"] > span[title]')
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
  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  await expect(previewNames(page)).toHaveText([sampleOutputs[0]], { timeout: 30000 })
})

test('Shift+ホイールは実ZIPの画像を1枚ずつ巡回し、本体と工程を分け、通常ホイールは選択を変えない', async ({ page }) => {
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

test('工程と自動マークを出力対象から外すとShift巡回も実ZIPと同じ対象へ絞られる', async ({ page }) => {
  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  const settings = page.getByRole('dialog', { name: '書き出し設定', exact: true })
  for (const name of ['演出 _e', '作監 _s', '自動マーク']) {
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
