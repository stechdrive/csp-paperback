import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { diagnostic } from 'celcodec'
import { readClipFile, clipReader } from '../../utils/clip-io'
import { ImageResourceError } from '../../utils/image-budget'
import type { ClipDocument } from '../../utils/clip/types'

const document = (): ClipDocument => ({ width: 16, height: 16, dpi: 72, layers: [], timelines: [], defaultTimelineId: null, diagnostics: [] })
class TestWorker {
  static instances: TestWorker[] = []
  onmessage?: (event: MessageEvent) => void
  onerror?: () => void
  onmessageerror?: () => void
  sent: { id: number; buffer?: ArrayBuffer; layerId?: string; maxDecodedBytes?: number }[] = []
  terminate = vi.fn()
  constructor() { TestWorker.instances.push(this) }
  postMessage(data: typeof this.sent[number], transfer: Transferable[]) {
    this.sent.push(structuredClone(data, { transfer }))
  }
  reply(value: object, id = this.sent.at(-1)!.id) { this.onmessage?.(new MessageEvent('message', { data: { ...value, id } })) }
}
beforeEach(() => { TestWorker.instances = []; vi.stubGlobal('Worker', TestWorker) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('CLIP Worker ownership', () => {
  it('transfers input and terminates eager metadata reads', async () => {
    const bytes = new ArrayBuffer(4), pending = readClipFile(bytes, false)
    const worker = TestWorker.instances[0]
    expect(bytes.byteLength).toBe(0)
    expect(worker.sent[0].buffer!.byteLength).toBe(4)
    worker.reply({ document: document() })
    expect(clipReader(await pending)).toBeUndefined()
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('retains a lazy session, preserves resource diagnostics and closes pending decodes exactly once', async () => {
    const pending = readClipFile(new ArrayBuffer(4), true, true), worker = TestWorker.instances[0]
    worker.reply({ document: document() })
    const reader = clipReader(await pending)!
    const limited = reader.decode('art', 16)
    expect(worker.sent.at(-1)?.maxDecodedBytes).toBe(16)
    worker.reply({ diagnostic: diagnostic('LIMIT_IMAGE_PIXELS', { limit: 4 }, 'error') })
    await expect(limited).rejects.toBeInstanceOf(ImageResourceError)
    expect(worker.terminate).not.toHaveBeenCalled()
    const retry = reader.decode('art')
    worker.reply({ layer: { id: 'art' }, diagnostics: [] })
    expect(await retry).toMatchObject({ layer: { id: 'art' } })
    const waiting = reader.decode('next')
    reader.dispose(); reader.dispose()
    await expect(waiting).rejects.toThrow('終了')
    await expect(reader.decode('closed')).rejects.toThrow('終了')
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('aborts both opening and active sessions without waiting for synchronous Worker work', async () => {
    const already = new AbortController(); already.abort()
    await expect(readClipFile(new ArrayBuffer(1), true, true, already.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(TestWorker.instances).toHaveLength(0)
    for (const opened of [false, true]) {
      const controller = new AbortController()
      const pending = readClipFile(new ArrayBuffer(1), true, true, controller.signal)
      const worker = TestWorker.instances.at(-1)!
      if (opened) {
        worker.reply({ document: document() })
        const reader = clipReader(await pending)!, decode = reader.decode('art')
        controller.abort()
        await expect(decode).rejects.toMatchObject({ name: 'AbortError' })
      } else {
        controller.abort()
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
      }
      expect(worker.terminate).toHaveBeenCalledOnce()
    }
  })

  it('terminates on timeouts, Worker errors and clone failures', async () => {
    vi.useFakeTimers()
    for (const failure of ['timeout', 'error', 'messageerror', 'diagnostic'] as const) {
      const pending = readClipFile(new ArrayBuffer(1)), worker = TestWorker.instances.at(-1)!
      const rejected = expect(pending).rejects.toBeInstanceOf(Error)
      if (failure === 'timeout') await vi.advanceTimersByTimeAsync(120000)
      if (failure === 'error') worker.onerror?.()
      if (failure === 'messageerror') worker.onmessageerror?.()
      if (failure === 'diagnostic') worker.reply({ diagnostic: diagnostic('INVALID_CONTAINER_HEADER') })
      await rejected
      expect(worker.terminate).toHaveBeenCalledOnce()
    }
    const post = vi.spyOn(TestWorker.prototype, 'postMessage').mockImplementationOnce(() => {
      throw new DOMException('cannot clone', 'DataCloneError')
    })
    await expect(readClipFile(new ArrayBuffer(1))).rejects.toMatchObject({ name: 'DataCloneError' })
    expect(TestWorker.instances.at(-1)!.terminate).toHaveBeenCalledOnce()
    post.mockRestore()
  })
})
