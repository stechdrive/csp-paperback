import { readFileSync } from 'node:fs'
import initSqlJs from 'sql.js'
import { expect, test } from './fixtures'
import { sessionFixture, sessionIds } from '../src/test/fixtures/clip-session'
import type { ClipDocument, ClipLayer } from '../src/utils/clip/types'

test('公開APIの文書を実Worker/WASMで遅延復元し、転送・解放・再読込を保つ', async ({ page }) => {
  const SQL = await initSqlJs({ wasmBinary: new Uint8Array(readFileSync('node_modules/sql.js/dist/sql-wasm.wasm')).buffer })
  const bytes = Buffer.from(await sessionFixture(SQL, [{ type: 'setTimelineFrameRate',
    timelineId: sessionIds.timeline, fps: 30, timingPolicy: 'preserve-time' }]))
  const large = Buffer.from(await sessionFixture(SQL, [{ type: 'resizeCanvas', width: 50000, height: 50000, anchor: 'top-left' }]))
  await page.goto('./')
  const opening = page.waitForEvent('worker')
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'session.clip', mimeType: 'application/octet-stream', buffer: bytes })
  const appWorker = await opening
  await expect(page.getByText('1件', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'キャンバス', exact: true }).click()
  const slider = page.getByRole('slider', { name: 'タイムラインのフレーム' })
  await expect(slider).toHaveAttribute('aria-valuemax', '28')
  await slider.focus(); await page.keyboard.press('End')
  await expect(slider).toHaveAttribute('aria-valuenow', '28')

  const results = await page.evaluate(async ({ url, base64, largeBase64, ids }) => {
    type Reply = { id: number; document?: ClipDocument; layer?: ClipLayer; diagnostic?: { code: string; kind: string }; error?: string }
    const worker = new Worker(url, { type: 'module' })
    const pending = new Map<number, (reply: Reply) => void>()
    worker.onmessage = (event: MessageEvent<Reply>) => { pending.get(event.data.id)?.(event.data); pending.delete(event.data.id) }
    let id = 0
    function send(request: object, transfer: Transferable[] = []): Promise<Reply> {
      return new Promise((resolve, reject) => {
        const n = ++id, timer = setTimeout(() => reject(new Error('Worker timed out')), 10000)
        pending.set(n, reply => { clearTimeout(timer); resolve(reply) })
        worker.postMessage({ ...request, id: n }, transfer)
      })
    }
    const input = () => Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer
    try {
      const buffer = input(), opening = send({ buffer, lazy: true }, [buffer])
      const detached = buffer.byteLength === 0, opened = await opening
      const first = await send({ layerId: ids.cel })
      const original = Array.from(first.layer!.pixels!.rgba)
      first.layer!.pixels!.rgba.fill(0)
      const second = await send({ layerId: ids.cel })
      const folder = await send({ layerId: ids.folder })
      worker.postMessage({ dispose: true })
      const closed = await send({ layerId: ids.cel })
      const malformed = new ArrayBuffer(24)
      const failed = await send({ buffer: malformed, lazy: true }, [malformed])
      const reopenedBuffer = input()
      const reopened = await send({ buffer: reopenedBuffer, lazy: true }, [reopenedBuffer])
      const again = await send({ layerId: ids.cel })
      const largeBuffer = Uint8Array.from(atob(largeBase64), c => c.charCodeAt(0)).buffer
      const largeDoc = await send({ buffer: largeBuffer, lazy: true }, [largeBuffer])
      const sparse = await send({ layerId: ids.cel, maxDecodedBytes: 4 })
      const limited = await send({ layerId: ids.cel, maxDecodedBytes: 3 })
      // Termination must also be possible while requests are queued in a real Worker.
      worker.postMessage({ id: ++id, layerId: ids.cel })
      return { detached, width: opened.document?.width, timeline: opened.document?.timelines[0],
        original, fresh: Array.from(second.layer!.pixels!.rgba), folderHasPixels: !!folder.layer?.pixels,
        closed: closed.diagnostic, failed: failed.diagnostic, reopened: reopened.document?.width,
        afterReopen: Array.from(again.layer!.pixels!.rgba), large: largeDoc.document?.width,
        sparse: Array.from(sparse.layer!.pixels!.rgba), limit: limited.diagnostic }
    } finally { worker.terminate() }
  }, { url: appWorker.url(), base64: bytes.toString('base64'), largeBase64: large.toString('base64'), ids: sessionIds })
  expect(results).toMatchObject({ detached: true, width: 64, original: [255, 0, 0, 255], fresh: [255, 0, 0, 255],
    folderHasPixels: false, closed: { code: 'CLOSED_DOCUMENT' }, failed: { kind: 'malformed' },
    reopened: 64, afterReopen: [255, 0, 0, 255], large: 50000, sparse: [255, 0, 0, 255],
    limit: { code: 'LIMIT_MATERIAL_BYTES', kind: 'resource-limit' } })
  expect(results.timeline).toMatchObject({ startFrame: 1.25, endFrame: 28.75, data: { duration: 27.5, fps: 30 } })

  const closing = appWorker.waitForEvent('close')
  await page.locator('input[type=file][multiple]').setInputFiles('public/sample/c001.clip')
  await closing
  await expect(page.getByText('8件', { exact: true })).toBeVisible()
})
