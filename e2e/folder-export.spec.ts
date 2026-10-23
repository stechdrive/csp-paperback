import { expect, test, type Page } from './fixtures'

async function seed(page: Page, files: Record<string, string>, folder?: string) {
  await page.evaluate(async ({ files, folder }) => {
    let root = await navigator.storage.getDirectory()
    if (folder) root = await root.getDirectoryHandle(folder, { create: true })
    for (const [name, text] of Object.entries(files)) {
      const stream = await (await root.getFileHandle(name, { create: true })).createWritable()
      await stream.write(text); await stream.close()
    }
  }, { files, folder })
}
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const files: Record<string, { size: number; hash: string; signature: number[]; text?: string }> = {}
    const walk = async (dir: FileSystemDirectoryHandle, prefix = '') => {
      const iterable = dir as FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> }
      for await (const item of iterable.values()) {
        if (item.kind === 'directory') await walk(item as FileSystemDirectoryHandle, `${prefix}${item.name}/`)
        else {
          const file = await (item as FileSystemFileHandle).getFile(), data = await file.arrayBuffer()
          const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(b => b.toString(16).padStart(2, '0')).join('')
          files[prefix + item.name] = { size: data.byteLength, hash, signature: [...new Uint8Array(data).slice(0, 4)], ...(data.byteLength < 100 ? { text: await file.text() } : {}) }
        }
      }
    }
    await walk(await navigator.storage.getDirectory())
    return files
  })
}
async function exportMode(page: Page, mode: 'direct' | 'folder') {
  await page.getByRole('button', { name: '出力', exact: true }).click()
  await page.getByRole('menuitem', { name: mode === 'direct' ? '選択フォルダに直接書き出し' : 'フォルダを作って書き出し', exact: true }).click()
}
async function done(page: Page) {
  await expect(page.getByTestId('export-status')).toHaveAttribute('data-phase', 'done', { timeout: 30000 })
}
async function loadSample(page: Page) {
  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  await expect(page.locator('[data-output-name]')).toHaveCount(9)
  await expect(page.getByRole('listbox', { name: '出力ファイル' })).toHaveAttribute('aria-busy', 'false')
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: () => navigator.storage.getDirectory() })
  })
  await page.goto('./')
})

test('real browser file handles: cancel, overwrite and rename preserve files and direct export stays flat', async ({ page }, testInfo) => {
  await loadSample(page)
  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  const settings = page.getByTestId('export-settings')
  await settings.getByRole('button', { name: 'PNG', exact: true }).click()
  await settings.getByRole('switch', { name: 'フォルダ分け', exact: true }).click()
  await expect(settings.getByRole('switch', { name: 'フォルダ分け', exact: true })).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Escape')
  const paths = await page.locator('[data-output-name]').allTextContents()
  const names = paths.map(path => path.split('/').at(-1)!)
  expect(names.length).toBeGreaterThan(1)
  await seed(page, { [names[0]]: 'original image', 'notes.txt': 'keep me' })
  const original = await snapshot(page)
  await exportMode(page, 'direct')
  const confirm = page.getByRole('dialog', { name: '同名画像の確認', exact: true })
  await expect(confirm).toContainText('上書き：1件')
  await expect(confirm).toContainText(`新規追加：${names.length - 1}件`)
  expect(await snapshot(page)).toEqual(original)
  await page.setViewportSize({ width: 480, height: 360 })
  await expect(confirm.getByRole('button', { name: '上書きする' })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('overwrite-confirmation.png') })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('export-status')).toHaveAttribute('data-phase', 'cancelled')
  expect(await snapshot(page)).toEqual(original)
  await page.setViewportSize({ width: 1280, height: 800 })
  await exportMode(page, 'direct')
  await confirm.getByRole('button', { name: '上書きする', exact: true }).click()
  await done(page)
  const written = await snapshot(page)
  expect(Object.keys(written).sort()).toEqual([...names, 'notes.txt'].sort())
  expect(names.every(name => written[name].signature.join(',') === '137,80,78,71')).toBe(true)
  expect(written['notes.txt']).toEqual(original['notes.txt'])
  expect(written[names[0]].hash).not.toBe(original[names[0]].hash)
  await exportMode(page, 'direct')
  await confirm.getByRole('button', { name: '別名で保存', exact: true }).click()
  await done(page)
  const repeated = await snapshot(page)
  expect(Object.keys(repeated)).toHaveLength(names.length * 2 + 1)
  for (const [name, value] of Object.entries(written)) expect(repeated[name]).toEqual(value)
  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  await expect(settings.getByRole('switch', { name: 'フォルダ分け', exact: true })).toHaveAttribute('aria-checked', 'true')
})

test('folder export can overwrite the existing root or save all images to a numbered root', async ({ page }) => {
  await loadSample(page)
  const names = await page.locator('[data-output-name]').allTextContents()
  await seed(page, { [names[0]]: 'old', 'notes.txt': 'keep' }, 'c001')
  await exportMode(page, 'folder')
  const confirm = page.getByRole('dialog', { name: '同名画像の確認', exact: true })
  await confirm.getByRole('button', { name: '上書きする', exact: true }).click()
  await done(page)
  const overwritten = await snapshot(page)
  expect(Object.keys(overwritten).length).toBe(names.length + 1)
  expect(overwritten[`c001/${names[0]}`].signature.slice(0, 3)).toEqual([255, 216, 255])
  expect(overwritten['c001/notes.txt'].text).toBe('keep')
  await exportMode(page, 'folder')
  await confirm.getByRole('button', { name: '新しいフォルダに保存', exact: true }).click()
  await done(page)
  const renamed = await snapshot(page)
  for (const [name, value] of Object.entries(overwritten)) expect(renamed[name]).toEqual(value)
  expect(names.every(name => renamed[`c001_2/${name}`].hash === overwritten[`c001/${name}`].hash)).toBe(true)
})

test('quick-export saving preference survives reload without changing manual output choices', async ({ page }) => {
  const details = async () => {
    await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
    await page.getByRole('button', { name: '詳細設定…', exact: true }).click()
  }
  await details()
  await expect(page.getByRole('radio', { name: 'フォルダを作る', exact: true })).toBeChecked()
  await page.getByRole('radio', { name: '直接書き出す', exact: true }).check()
  await page.keyboard.press('Escape')
  await page.reload()
  await details()
  await expect(page.getByRole('radio', { name: '直接書き出す', exact: true })).toBeChecked()
  await page.keyboard.press('Escape')
  await loadSample(page)
  await exportMode(page, 'folder')
  await done(page)
  expect(Object.keys(await snapshot(page)).every(name => name.startsWith('c001/'))).toBe(true)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('csp-paperback:settings')!))
  expect(stored.state.directoryExportMode).toBe('direct-flat')
  expect(JSON.stringify(stored)).not.toContain('overwrite')
})
