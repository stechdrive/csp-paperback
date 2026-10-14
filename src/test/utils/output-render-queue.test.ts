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

describe('preview resource limits', () => {
  it('notifies only consumers of the completed file and resolution', async () => {
    const queue = new OutputRenderQueue(), a = file('a'), b = file('b')
    const aThumb = vi.fn(), aFull = vi.fn(), bThumb = vi.fn()
    queue.subscribe([a], 'thumbnail', aThumb)
    queue.subscribe([a], 'full', aFull)
    queue.subscribe([b], 'thumbnail', bThumb)
    queue.request(a, 'thumbnail', image)
    await vi.runAllTimersAsync()
    expect(aThumb).toHaveBeenCalledTimes(1)
    expect(aFull).not.toHaveBeenCalled()
    expect(bThumb).not.toHaveBeenCalled()
    queue.clear()
  })
  it('renders a sheet once for simultaneous tile and thumbnail requests', async () => {
    const queue = new OutputRenderQueue(), a = file('a'), draw = vi.fn(image)
    queue.request(a, 'thumbnail', draw)
    queue.request(a, 'comparison', draw)
    await vi.runAllTimersAsync()
    expect(draw).toHaveBeenCalledTimes(1)
    expect(queue.get(a, 'full')).toBeUndefined()
    expect(queue.get(a, 'comparison')?.image?.canvas.width).toBe(300)
    expect(queue.get(a, 'thumbnail')?.image?.canvas.width).toBe(160)
    queue.clear()
  })
  it('suspends queued previews during export and cancels offscreen work immediately', async () => {
    const queue = new OutputRenderQueue(), draw = vi.fn(image), resume = queue.pause()
    queue.request(file('a'), 'full', draw)
    const cancel = queue.request(file('offscreen'), 'thumbnail', draw)
    cancel()
    await vi.runAllTimersAsync()
    expect(draw).not.toHaveBeenCalled()
    expect(queue.getStats().pending).toBe(1)
    resume(); resume()
    await vi.runAllTimersAsync()
    expect(draw).toHaveBeenCalledTimes(1)
    queue.clear()
  })
  it('reclaims an oversized preview immediately when its view closes and bounds metadata', async () => {
    const queue = new OutputRenderQueue(60000, 3)
    const release = queue.request(file('large'), 'full', image)
    await vi.runAllTimersAsync()
    expect(queue.getStats().bytes).toBe(240000)
    release()
    expect(queue.getStats().bytes).toBe(0)
    for (let i = 0; i < 10; i++) {
      const unpin = queue.request(file(String(i)), 'thumbnail', image)
      await vi.runAllTimersAsync()
      unpin()
    }
    expect(queue.getStats().bytes).toBeLessThanOrEqual(60000)
    expect(queue.getStats().entries).toBeLessThanOrEqual(3)
    queue.clear()
  })
})

it('immediately releases temporary native-resolution pixels after making thumbnails', async () => {
  const queue = new OutputRenderQueue(), source = image(), a = file('thumbnail-only')
  queue.request(a, 'thumbnail', () => source)
  await vi.runAllTimersAsync()
  expect(source.canvas.width).toBe(1)
  expect(queue.get(a, 'thumbnail')?.image?.canvas.width).toBe(160)
  queue.clear()
})
