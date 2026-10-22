import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from './fixtures'

async function expectLoadedFiles(page: Page, files: string[]) {
  await page.getByRole('button', { name: 'メニュー', exact: true }).click()
  for (const file of files) {
    await expect(page.locator('#toolbar-app-menu').getByText(file, { exact: true })).toBeVisible({ timeout: 30000 })
  }
  await page.keyboard.press('Escape')
}

async function exportZip(page: Page) {
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: '出力', exact: true }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('c001.zip')
  const bytes = await readFile((await download.path())!)
  expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
  expect(bytes.length).toBeGreaterThan(1000)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined })
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined })
  })
})

test('サンプルボタンはCLIPだけを取得し、仮想セルを含む出力を作る', async ({ page }) => {
  const files: string[] = []
  page.on('request', request => { if (/\.(clip|psd|xdts)(?:\?|$)/.test(request.url())) files.push(new URL(request.url()).pathname) })
  await page.goto('./')
  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  await page.getByRole('button', { name: '出力プレビュー', exact: true }).click()
  await expectLoadedFiles(page, ['c001.clip'])
  await expect(page.getByText('CLIPから読み込み', { exact: true })).toHaveCount(0)
  const virtualToggle = page.getByRole('button', { name: '仮想セル', exact: true })
  await expect(virtualToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('virtual-panel')).toBeHidden()
  await virtualToggle.click()
  await expect(page.getByText('仮想セルテスト', { exact: true }).first()).toBeVisible()
  expect(files).toEqual(['/csp-paperback/sample/c001.clip'])
  await exportZip(page)
})

test('CLIP＋PSDを読み込み、実ZIPを出力し、従来のPSD＋XDTSへ切り替えられる', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles(['public/sample/c001.clip', 'testdata/c001.psd'])
  await expectLoadedFiles(page, ['c001.psd', 'c001.clip'])
  await expect(page.getByRole('button', { name: /^再現状況/ })).toHaveCount(0)
  await exportZip(page)
  await page.locator('input[type=file][multiple]').setInputFiles(['testdata/c001.psd', 'testdata/c001.xdts'])
  await expectLoadedFiles(page, ['c001.psd', 'c001.xdts'])
  await expect(page.getByRole('combobox', { name: 'タイムライン', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^再現状況/ })).toHaveCount(0)
  await exportZip(page)
  expect(errors).toEqual([])
})

test('CLIP単独で出力でき、後からPSDを追加すると純正画像へ切り替わる', async ({ page }) => {
  const errors: string[] = []
  const requests: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('request', request => requests.push(request.url()))
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles('public/sample/c001.clip')
  await expectLoadedFiles(page, ['c001.clip'])
  await expect(page.getByRole('button', { name: /^再現状況/ })).toHaveCount(0)
  await exportZip(page)
  await page.locator('input[type=file][multiple]').setInputFiles('testdata/c001.psd')
  await expectLoadedFiles(page, ['c001.psd'])
  await expect(page.getByRole('button', { name: /^再現状況/ })).toHaveCount(0)
  await exportZip(page)
  expect(errors).toEqual([])
  expect(requests.filter(url => /^https?:/.test(url)).every(url => new URL(url).hostname === '127.0.0.1')).toBe(true)
})

test('同梱CLIPテンプレートを単独で読み込み、タイムラインを表示できる', async ({ page }) => {
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles('public/templates/csp-paperback-sample-template.clip')
  await expectLoadedFiles(page, ['csp-paperback-sample-template.clip'])
  await page.getByRole('button', { name: '全体プレビュー', exact: true }).click()
  await expect(page.getByText('0秒1コマ', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '出力', exact: true })).toBeEnabled()
})

test('デスクトップのCSP設定でも同梱WorkerとWASMを実行できる', async ({ page, context }) => {
  const config = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'))
  await context.route('**/*', async route => {
    const response = await route.fetch()
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': config.app.security.csp } })
  })
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('./')
  await page.locator('input[type=file][multiple]').setInputFiles(['public/sample/c001.clip', 'testdata/c001.psd'])
  await expectLoadedFiles(page, ['c001.psd', 'c001.clip'])
  await expect(page.getByRole('button', { name: /^再現状況/ })).toHaveCount(0)
  await exportZip(page)
  expect(errors).toEqual([])
})
