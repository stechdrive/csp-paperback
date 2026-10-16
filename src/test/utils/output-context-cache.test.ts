import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvas as nativeCanvas } from '@napi-rs/canvas'
import { buildLayerTree } from '../../engine/tree-builder'
import { OutputContextCache } from '../../engine/output-context-cache'
import { renderOutputFile, OutputRenderQueue } from '../../utils/output-render-queue'
import { buildOutputPlan } from '../../utils/output-plan'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS } from '../../types'
import { makeAnimationFolder, makeLayer, makePsd, makeCanvas } from '../helpers/psd-factory'
import { createCanvas } from '../../engine/compositor'

beforeEach(() => {
  const original = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag, options) => tag === 'canvas'
    ? nativeCanvas(1, 1) as unknown as HTMLCanvasElement : original(tag, options))
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
const pixels = (c: HTMLCanvasElement) => Buffer.from(c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data)
function fixture() {
  const ink = makeCanvas(16, 12); ink.getContext('2d')!.fillRect(0, 0, 16, 12)
  const mask = makeCanvas(16, 12), m = mask.getContext('2d')!; m.fillStyle = '#999'; m.fillRect(0, 0, 16, 12)
  const bg = makeLayer({ name: 'paper', canvas: ink, opacity: 1, left: 20 }); bg.mask = { canvas: mask, defaultColor: 255 }
  const tree = buildLayerTree(makePsd({ width: 160, height: 120, children: [bg,
    ...['A', 'B', 'C'].map(name => makeAnimationFolder(name, [1, 2, 3].map(n => makeLayer({ name: String(n), canvas: ink, opacity: 0.7 })))),
  ] }))
  for (const layer of tree) if (layer.isFolder) { layer.isAnimationFolder = true; layer.animationFolder = { detectedBy: 'manual', trackName: layer.name } }
  const state = { docWidth: 160, docHeight: 120, virtualSets: [], timelineData: null, outputConfig: DEFAULT_OUTPUT_CONFIG, projectSettings: DEFAULT_PROJECT_SETTINGS }
  return { files: buildOutputPlan(tree, state), tree, state, ink, mask }
}

describe('bounded shared output contexts', () => {
  it('reuses masked common material across preview jobs and preserves every pixel, source and warning', async () => {
    vi.useFakeTimers()
    const { files, ink, mask } = fixture(), queue = new OutputRenderQueue(), inputs = [pixels(ink), pixels(mask)]
    const release = files.slice(0, 3).map(file => queue.request(file, 'full', cache => renderOutputFile(file, [], false, cache)))
    await vi.runAllTimersAsync()
    expect(queue.getStats().contextEntries).toBe(1)
    expect(queue.getStats().contextBytes).toBe(160 * 120 * 4)
    for (const file of files.slice(0, 3)) {
      const warm = queue.get(file, 'full')!.image!, cold = renderOutputFile(file, [], false)
      expect(pixels(warm.canvas)).toEqual(pixels(cold.canvas))
      expect(warm.sources).toEqual(cold.sources)
      expect(warm.vectorWarning).toBe(cold.vectorWarning)
    }
    const displayed = queue.get(files[0], 'full')!.image!.canvas, saved = pixels(displayed)
    release.forEach(fn => fn()); queue.clear()
    expect(queue.getStats().contextBytes).toBe(0)
    expect(pixels(displayed)).toEqual(saved)
    expect([pixels(ink), pixels(mask)]).toEqual(inputs)
  })

  it('evicts by byte budget and entry count, releases only owned context pixels, and rebuilds identical results', () => {
    const { files, ink } = fixture(), cache = new OutputContextCache(160 * 120 * 4, 1)
    renderOutputFile(files[0], [], false, cache)
    const firstContext = [...cache.values()][0].upper.concat([...cache.values()][0].lower).find(f => f.canvas !== ink)!.canvas
    for (const index of [3, 6, 0]) {
      const image = renderOutputFile(files[index], [], false, cache)
      expect(pixels(image.canvas)).toEqual(pixels(renderOutputFile(files[index], [], false).canvas))
      expect(cache.size).toBeLessThanOrEqual(1); expect(cache.bytes).toBeLessThanOrEqual(160 * 120 * 4)
    }
    expect(firstContext.width * firstContext.height).toBe(1)
    cache.clear(); expect(ink.width).toBe(16)
    const tiny = new OutputContextCache(1)
    const result = renderOutputFile(files[0], [], false, tiny)
    expect(tiny.size).toBe(0); expect(result.canvas.width).toBe(160)
  })

  it('does not reuse contexts from a changed plan and clears allocations after a render failure', () => {
    const { files, tree, state } = fixture(), cache = new OutputContextCache()
    const before = pixels(renderOutputFile(files[0], [], false, cache).canvas)
    const next = buildOutputPlan(tree.map(l => l.originalName === 'paper' ? { ...l, uiHidden: true } : l), state)
    const image = renderOutputFile(next[0], [], false, cache)
    expect(pixels(image.canvas)).toEqual(pixels(renderOutputFile(next[0], [], false).canvas))
    expect(pixels(image.canvas)).not.toEqual(before)
    let temporary!: HTMLCanvasElement
    expect(() => renderOutputFile({ ...files[0], renderCanvas: () => { temporary = createCanvas(40, 30); throw Error('bad render') } }, [], false, cache)).toThrow('bad render')
    expect(temporary.width).toBe(1); expect(cache.size).toBe(0); expect(cache.bytes).toBe(0)
  })
})
