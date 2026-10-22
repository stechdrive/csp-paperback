import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

// Capture every guide image and its highlight coordinates from the same UI state.
// Use source directly so an old dist cannot silently produce outdated help images.
const viewport = { width: 1440, height: 1000 }
const port = 4191
const server = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort',
], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
const screenshots = {}
const captures = []
const errors = []
let browser

try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Help capture server did not start')), 15000)
    server.stdout.on('data', data => {
      if (data.toString().includes('Local:')) { clearTimeout(timeout); resolve() }
    })
    server.stderr.on('data', data => process.stderr.write(data))
    server.on('error', error => { clearTimeout(timeout); reject(error) })
    server.on('exit', code => { clearTimeout(timeout); reject(new Error(`Help capture server exited: ${code}`)) })
  })
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  await page.addInitScript(() => localStorage.setItem('csp-paperback:settings', JSON.stringify({
    state: { activeTheme: 'paper' }, version: 2,
  })))
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })

  async function bounds(locator) {
    await expect(locator).toBeVisible()
    const box = await locator.boundingBox()
    assert(box)
    return box
  }

  function cropTo(box, padding = 16) {
    const x = Math.max(0, Math.floor(box.x - padding))
    const y = Math.max(0, Math.floor(box.y - padding))
    return {
      x, y,
      width: Math.min(viewport.width, Math.ceil(box.x + box.width + padding)) - x,
      height: Math.min(viewport.height, Math.ceil(box.y + box.height + padding)) - y,
    }
  }

  async function capture(name, regions, crop = { x: 0, y: 0, ...viewport }) {
    await page.mouse.move(0, viewport.height - 1)
    await page.evaluate(() => document.fonts.ready)
    let previous
    await expect.poll(async () => {
      const current = await page.screenshot({ clip: crop, animations: 'disabled' })
      const settled = previous?.equals(current) ?? false
      previous = current
      return settled
    }, { timeout: 10000, intervals: [100, 200, 400] }).toBe(true)
    const relativeRegions = Object.fromEntries(Object.entries(regions).map(([key, box]) => {
      assert(box.x >= crop.x && box.y >= crop.y && box.x + box.width <= crop.x + crop.width + 0.5
        && box.y + box.height <= crop.y + crop.height + 0.5, `${key} is outside ${name}`)
      const percent = (value, total) => Math.round(value / total * 10000) / 100
      return [key, {
        x: percent(box.x - crop.x, crop.width), y: percent(box.y - crop.y, crop.height),
        width: percent(box.width, crop.width), height: percent(box.height, crop.height),
      }]
    }))
    screenshots[name] = {
      width: crop.width, height: crop.height,
      sha256: createHash('sha256').update(previous).digest('hex'), regions: relativeRegions,
    }
    captures.push([name, previous])
  }

  await page.goto(`http://127.0.0.1:${port}/csp-paperback/`)
  await capture('startup-guide.png', { startupSettings: await bounds(page.getByTestId('startup-export-settings')) })
  await page.getByRole('button', { name: 'サンプルデータで試す', exact: true }).click()
  await expect(page.getByTestId('tiled-preview')).toHaveAttribute('aria-busy', 'false', { timeout: 30000 })
  await expect(page.getByRole('listbox', { name: '出力ファイル' })).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: '仮想セル', exact: true }).click()
  await expect(page.getByRole('button', { name: 'タイル表示', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '画面に収める', exact: true }).click()

  // Desktop help must show the current side-by-side output list and layer tree.
  const list = await bounds(page.getByRole('listbox', { name: '出力ファイル' }))
  const tree = await bounds(page.getByTestId('layer-tree'))
  assert(list.x + list.width < tree.x, 'Output list and layer tree must be side by side')
  assert(Math.abs(list.y - tree.y) < 4, 'Output list and layer tree must share their top edge')
  await capture('loaded-overview.png', {
    virtualCels: await bounds(page.getByTestId('virtual-panel')),
    preview: await bounds(page.getByTestId('main-preview')),
    layers: await bounds(page.getByTestId('source-panel')),
    output: await bounds(page.getByTestId('output-view')),
  })

  await page.getByRole('button', { name: '全体プレビュー', exact: true }).click()
  await expect.poll(() => page.getByTestId('navigator-view').locator('canvas').first()
    .evaluate(canvas => canvas.width)).toBeGreaterThan(1)
  await capture('whole-preview.png', { navigator: await bounds(page.getByTestId('navigator-view')) })
  await page.getByRole('button', { name: '出力プレビュー', exact: true }).click()

  await page.getByRole('button', { name: '書き出し設定', exact: true }).click()
  const exportSettings = await bounds(page.getByRole('dialog', { name: '書き出し設定', exact: true }))
  await capture('export-settings.png', { exportSettings }, cropTo(exportSettings))
  await page.keyboard.press('Escape')

  const trigger = page.getByRole('button', { name: '出力', exact: true })
  await trigger.click()
  const menu = await bounds(page.getByRole('menuitem', { name: 'ZIP', exact: true }).locator('..'))
  const button = await bounds(trigger)
  const outputMenu = {
    x: Math.min(menu.x, button.x), y: button.y,
    width: Math.max(menu.x + menu.width, button.x + button.width) - Math.min(menu.x, button.x),
    height: menu.y + menu.height - button.y,
  }
  await capture('output-menu.png', { outputMenu }, cropTo(outputMenu))
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: '設定', exact: true }).click()
  const settings = page.locator('[class*="_dialog_"]').filter({ has: page.getByText('書き出し詳細設定', { exact: true }) })
  const settingsDialog = await bounds(settings)
  await capture('settings-dialog.png', {
    settingsDialog,
    processSettings: await bounds(settings.getByTestId('process-table-grid').locator('..')),
  }, cropTo(settingsDialog))

  assert.deepEqual(errors, [])
  for (const [name, bytes] of captures) await writeFile(`public/help/${name}`, bytes)
  await writeFile('src/components/help/helpScreenshots.json', `${JSON.stringify(screenshots, null, 2)}\n`)
  console.log(`Updated ${captures.length} help images and their measured highlight regions.`)
} finally {
  await browser?.close()
  server.kill()
}
