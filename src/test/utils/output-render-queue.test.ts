import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputRenderQueue, type RenderedOutput } from '../../utils/output-render-queue'
import type { OutputFile } from '../../utils/output-plan'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
const file = (id: string) => ({ outputId: id }) as OutputFile
function image(): RenderedOutput {
  const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 200
  return { canvas, sources: { all: new Set(['ink']), content: new Set(['ink']) }, vectorWarning: false, unsupported3D: false }
}

describe('output render queue', () => {
  it('prioritizes the full preview, shares it with thumbnails, and discards obsolete requests', async () => {
    const queue = new OutputRenderQueue(), active = file('active'), old = file('old')
    const order: string[] = []
    const draw = vi.fn(() => { order.push('active'); return image() })
    queue.request(active, 'thumbnail', draw)
    const cancel = queue.request(old, 'full', () => { order.push('old'); return image() })
    queue.request(active, 'full', draw)
    cancel()
    await vi.runAllTimersAsync()
    expect(order).toEqual(['active'])
    expect(queue.get(active, 'thumbnail')!.image!.canvas.width).toBe(160)
    expect(queue.get(active, 'full')!.image!.canvas.width).toBe(300)
    expect(queue.get(old, 'full')).toBeUndefined()
    queue.clear()
  })
  it('evicts unreferenced buffers but keeps a displayed oversize canvas intact', async () => {
    const queue = new OutputRenderQueue(300 * 200 * 4), a = file('a'), b = file('b'), thumb = file('thumb')
    const release = queue.request(a, 'full', image)
    await vi.runAllTimersAsync()
    const heldCanvas = queue.get(a, 'full')!.image!.canvas
    release()
    queue.request(b, 'full', image)
    await vi.runAllTimersAsync()
    queue.request(thumb, 'thumbnail', image)
    await vi.runAllTimersAsync()
    expect(queue.get(a, 'full')).toBeUndefined()
    expect(queue.get(b, 'full')!.image!.canvas.width).toBe(300)
    expect(heldCanvas.width).toBe(300)
    queue.clear()
  })
  it('clears queued work on a new document and reports rendering failures', async () => {
    const queue = new OutputRenderQueue(), old = file('old'), bad = file('bad')
    const draw = vi.fn(image)
    queue.request(old, 'full', draw)
    queue.clear()
    queue.request(bad, 'full', () => { throw new Error('render failure') })
    await vi.runAllTimersAsync()
    expect(draw).not.toHaveBeenCalled()
    expect(queue.get(bad, 'full')!.error).toBe('render failure')
    queue.clear()
  })
  it('a visible thumbnail does not pin its previous full-size preview', async () => {
    const queue = new OutputRenderQueue(300 * 200 * 4), a = file('a'), b = file('b')
    queue.request(a, 'thumbnail', image)
    const releaseFull = queue.request(a, 'full', image)
    await vi.runAllTimersAsync()
    releaseFull()
    queue.request(b, 'full', image)
    await vi.runAllTimersAsync()
    expect(queue.get(a, 'full')).toBeUndefined()
    expect(queue.get(a, 'thumbnail')?.image?.canvas.width).toBe(160)
    expect(queue.get(b, 'full')?.image?.canvas.width).toBe(300)
    queue.clear()
  })
})
