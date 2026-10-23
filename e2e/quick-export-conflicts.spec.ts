import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from './fixtures'

interface Proof {
  writes: { path: string; overwrite: boolean; size: number; signature: number[] }[]
  files: Record<string, number[]>
  reads: string[]
}
async function proof(page: Page): Promise<Proof> {
  return page.evaluate(() => (window as unknown as { __conflictProof: Proof }).__conflictProof)
}

for (const mode of ['subfolder', 'direct-flat'] as const) {
  test(`${mode}: batch overwrite permission ends with the invocation and never replaces an earlier cut`, async ({ page }) => {
    const clip = await readFile('public/sample/c001.clip')
    await page.route('**/__quick-conflict/*', route => route.fulfill({ body: clip, contentType: 'application/octet-stream' }))
    await page.addInitScript(({ mode, size }) => {
      const paths = ['C:/cuts/first.clip', 'C:/cuts/second.clip']
      const existing = mode === 'subfolder'
        ? ['C:/cuts/first/_PAN.jpg', 'C:/cuts/second/_PAN.jpg']
        : ['C:/cuts/_PAN.jpg', 'C:/cuts/_PAN_2.jpg']
      const state: Proof = {
        writes: [], reads: [],
        files: Object.fromEntries([...existing, 'C:/cuts/notes.txt'].map(path => [path, [1, 2, 3]])),
      }
      const directories = mode === 'subfolder' ? ['C:/cuts/first', 'C:/cuts/second'] : []
      const host = window as unknown as Record<string, unknown>
      host.isTauri = true
      host.__conflictProof = state
      if (!localStorage.getItem('csp-paperback:settings')) {
        localStorage.setItem('csp-paperback:settings', JSON.stringify({ version: 2, state: { directoryExportMode: mode } }))
      }
      const parent = (path: string) => path.slice(0, path.lastIndexOf('/'))
      host.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' } },
        invoke: async (command: string, args: { path?: string; paths?: string[] } | Uint8Array, options?: { headers?: Record<string, string> }) => {
          const params = args as { path?: string; paths?: string[] }
          if (command === 'get_launch_args') return paths
          if (command === 'allow_launch_file_paths' || command.startsWith('plugin:window|')) return
          if (command === 'plugin:path|dirname') return parent(params.path!)
          if (command === 'plugin:path|join') return params.paths!.join('/')
          if (command === 'plugin:fs|read_dir') return [
            ...directories.filter(path => parent(path) === params.path).map(path => ({ name: path.split('/').at(-1), isDirectory: true, isFile: false, isSymlink: false })),
            ...Object.keys(state.files).filter(path => parent(path) === params.path).map(path => ({ name: path.split('/').at(-1), isDirectory: false, isFile: true, isSymlink: false })),
          ]
          if (command === 'plugin:fs|mkdir') { directories.push(params.path!); return }
          if (command === 'plugin:fs|stat') return { size, mtime: null, atime: null, birthtime: null }
          if (command === 'plugin:fs|read_file') {
            state.reads.push(params.path!)
            return (await fetch('/__quick-conflict/sample.clip')).arrayBuffer()
          }
          if (command === 'write_export_file') {
            const path = decodeURIComponent(options!.headers!.path), overwrite = options!.headers!.overwrite === 'true'
            if (path in state.files && !overwrite) throw 'destination-exists'
            const bytes = args as Uint8Array, signature = [...bytes.slice(0, 3)]
            state.files[path] = signature
            state.writes.push({ path, overwrite, size: bytes.length, signature })
            return
          }
          throw new Error(`Unexpected desktop command: ${command}`)
        },
      }
    }, { mode, size: clip.length })
    await page.goto('./')
    const confirmation = page.getByRole('dialog', { name: '同名画像の確認', exact: true })
    await expect(confirmation).toContainText('上書き：1件')
    expect((await proof(page)).writes).toEqual([])
    await confirmation.getByRole('checkbox', { name: '残りのカットにも適用' }).check()
    await confirmation.getByRole('button', { name: '上書きする', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('成功 2件／失敗 0件', { timeout: 30000 })
    const written = await proof(page)
    expect(written.writes.length).toBeGreaterThan(2)
    expect(written.writes.filter(write => write.overwrite)).toHaveLength(2)
    expect(new Set(written.writes.map(write => write.path)).size).toBe(written.writes.length)
    expect(written.writes.every(write => write.size > 100 && write.signature.join(',') === '255,216,255')).toBe(true)
    expect(written.files['C:/cuts/notes.txt']).toEqual([1, 2, 3])
    if (mode === 'direct-flat') expect(written.writes.every(write => write.path.split('/').length === 3)).toBe(true)
    else expect(written.writes.every(write => /\/(first|second)\//.test(write.path))).toBe(true)

    // A new invocation must ask again; the checkbox is deliberately not persisted.
    await page.reload()
    await expect(confirmation).toBeVisible()
    await expect(confirmation.getByRole('checkbox', { name: '残りのカットにも適用' })).not.toBeChecked()
    await confirmation.getByRole('button', { name: 'キャンセル', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('書き出しをキャンセルしました')
    const cancelled = await proof(page)
    expect(cancelled.writes).toEqual([])
    expect(cancelled.reads).toEqual(['C:/cuts/first.clip'])
    await expect(page.getByTestId('quick-export-result')).toHaveCount(1)
  })
}
