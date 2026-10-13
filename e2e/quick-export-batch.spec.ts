import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { clipVectorFixture } from './helpers/clip-vector-fixture'

test('EXE launch flow exports a mixed batch, shows individual errors/warnings, and fits the small window', async ({ page }, testInfo) => {
  test.setTimeout(90000)
  const clip = await readFile('public/sample/c001.clip')
  const psd = await readFile('testdata/c001.psd')
  const inputs: Record<string, Buffer> = {
    'paired.clip': clip, 'paired.psd': psd, 'solo.clip': clip,
    'mismatch.clip': await readFile('public/templates/csp-paperback-sample-template.clip'), 'mismatch.psd': psd,
    'warning.clip': await clipVectorFixture(), 'orphan.psd': psd,
  }
  await page.route('**/__batch-fixture/*', route => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1)!)
    return route.fulfill({ body: inputs[name], contentType: 'application/octet-stream' })
  })
  const launchPaths = ['paired.psd', 'solo.clip', 'paired.clip', 'mismatch.clip', 'mismatch.psd', 'warning.clip', 'orphan.psd'].map(name => `C:/cuts/${name}`)
  await page.addInitScript(({ paths }) => {
    const proof = { writes: [] as { path: string; size: number; signature: number[] }[], dirs: ['C:/cuts/paired'], reads: [] as string[], closed: false }
    const host = window as unknown as Record<string, unknown>
    host.isTauri = true
    host.__batchProof = proof
    host.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' } },
      invoke: async (command: string, args: { path?: string; paths?: string[] } | Uint8Array, options?: { headers?: { path?: string } }) => {
        const params = args as { path?: string; paths?: string[] }
        if (command === 'get_launch_args') return paths
        if (command === 'allow_launch_file_paths') return
        if (command.startsWith('plugin:window|')) { if (command.endsWith('|close')) proof.closed = true; return }
        if (command === 'plugin:path|dirname') return params.path!.slice(0, params.path!.lastIndexOf('/'))
        if (command === 'plugin:path|join') return params.paths!.join('/')
        if (command === 'plugin:fs|exists') return proof.dirs.includes(params.path!)
        if (command === 'plugin:fs|mkdir') { proof.dirs.push(params.path!); return }
        if (command === 'plugin:fs|read_file') {
          proof.reads.push(params.path!)
          return (await fetch(`/__batch-fixture/${encodeURIComponent(params.path!.split('/').at(-1)!)}`)).arrayBuffer()
        }
        if (command === 'plugin:fs|write_file') {
          const bytes = args as Uint8Array
          proof.writes.push({ path: decodeURIComponent(options!.headers!.path!), size: bytes.length, signature: [...bytes.slice(0, 3)] })
          return
        }
        throw new Error(`Unexpected desktop command: ${command}`)
      },
    }
  }, { paths: launchPaths })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 640, height: 520 })
  await page.goto('./')
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('成功 3件／失敗 2件／注意 1件', { timeout: 60000 })
  const results = page.getByTestId('quick-export-result')
  await expect(results).toHaveCount(5)
  await expect(results.filter({ hasText: '成功：paired.clip' })).toContainText('出力先: C:/cuts/paired_2')
  await expect(results.filter({ hasText: '失敗：mismatch.clip' })).toContainText('一致しません')
  await expect(results.filter({ hasText: '失敗：orphan.psd' })).toContainText('同じフォルダ・同名のCLIP')
  const warning = results.filter({ hasText: '成功：warning.clip' })
  await warning.locator('summary').click()
  await expect(warning).toContainText('ベクターを近似描画')
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  const proof = await page.evaluate(() => (window as unknown as { __batchProof: { writes: { path: string; size: number; signature: number[] }[]; reads: string[] } }).__batchProof)
  expect(proof.writes.length).toBeGreaterThan(0)
  expect(proof.writes.every(write => write.size > 100 && write.signature.join(',') === '255,216,255')).toBe(true)
  expect(proof.writes.every(write => /\/(paired_2|solo|warning)\//.test(write.path))).toBe(true)
  expect(proof.reads.some(path => path.endsWith('orphan.psd'))).toBe(false)
  expect(proof.reads.filter(path => path.endsWith('.clip'))).toHaveLength(4)
  for (const viewport of [{ width: 640, height: 520 }, { width: 480, height: 360 }]) {
    await page.setViewportSize(viewport)
    const button = page.getByRole('button', { name: 'OK', exact: true })
    await expect(button).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`batch-${viewport.width}.png`) })
  }
  await page.getByRole('button', { name: 'OK', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __batchProof: { closed: boolean } }).__batchProof.closed)).toBe(true)
  expect(errors).toEqual([])
})
