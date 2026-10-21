import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createCanvas as nativeCanvas } from '@napi-rs/canvas'
import { buildLayerTree } from '../../engine/tree-builder'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS, type CspLayer } from '../../types'
import { buildOutputPlan } from '../../utils/output-plan'
import { renderOutputFileAsync } from '../../utils/output-render-queue'
import { renderOutputRegion, renderOutputOverview } from '../../utils/output-region-render'
import { createRegionPreview } from '../../engine/preview-region'
import { registerMaterial } from '../../engine/material-cache'

let spy: ReturnType<typeof vi.spyOn>
beforeAll(() => {
  const create = document.createElement.bind(document)
  spy = vi.spyOn(document, 'createElement').mockImplementation((name: string, options?: ElementCreationOptions) =>
    name === 'canvas' ? nativeCanvas(1, 1) as unknown as HTMLCanvasElement : create(name, options))
})
afterAll(() => spy.mockRestore())
function pixels(canvas: HTMLCanvasElement, x = 0, y = 0, width = canvas.width, height = canvas.height) {
  return Buffer.from(canvas.getContext('2d')!.getImageData(x, y, width, height).data)
}
function paint(width: number, height: number, color = '#d03158') {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color; ctx.fillRect(6, 5, width - 11, height - 9)
  ctx.clearRect(19, 8, 6, height - 20)
  ctx.fillStyle = '#1e6288'; ctx.fillRect(0, Math.floor(height / 2), width, 1)
  return canvas
}
function plan(tree: CspLayer[], width = 1103, height = 713) {
  tree[0].singleMark = true
  return buildOutputPlan(tree, { docWidth: width, docHeight: height, virtualSets: [], timelineData: null,
    projectSettings: DEFAULT_PROJECT_SETTINGS, outputConfig: { ...DEFAULT_OUTPUT_CONFIG, background: 'transparent' } })[0]
}

describe('native preview regions', () => {
  it.each(['plain', 'mask', 'relative mask', 'folder mask', 'edge', 'watercolor', 'native blend', 'adjustment', 'fractional'])(
    'matches full composition across chunk boundaries: %s', async kind => {
      const tree = buildLayerTree(makePsd({ children: [makeFolder('_sheet', [
        makeLayer({ name: 'base', canvas: paint(800, 580), left: 97, top: 61 }),
        makeLayer({ name: 'ink', canvas: paint(520, 340, '#36b289'), left: 341, top: 251, clipping: true, opacity: 170 }),
      ])] }))
      const base = tree[0].children.find(layer => layer.originalName === 'base')!
      if (kind.includes('mask')) {
        const layer = kind === 'folder mask' ? tree[0] : base
        layer.agPsdRef.mask = { canvas: paint(501, 401, '#aaa'), left: 80, top: 45, defaultColor: 255, positionRelativeToLayer: kind === 'relative mask' }
      }
      if (kind === 'edge') {
        base.materialEffects = { edge: { radius: 7.5, color: [30, 45, 90] } }
        tree[0].materialEffects = { edge: { radius: 3, color: [190, 120, 10] } }
      }
      if (kind === 'watercolor') base.materialEffects = { watercolor: { range: 5, opacity: 2, darkness: 30, blur: 4, style: 0 } }
      if (kind === 'native blend') { tree[0].children[0].nativeBlendMode = 12; tree[0].children[0].blendMode = 'linear dodge' }
      if (kind === 'adjustment') tree[0].children[0].adjustment = { kind: 'invert' }
      if (kind === 'fractional') { base.left += .25; base.top += .5 }
      const file = plan(tree), full = await renderOutputFileAsync(file, [], false)
      for (const region of [{ left: 0, top: 0, width: 80, height: 80 }, { left: 479, top: 239, width: 80, height: 93 }, { left: 804, top: 502, width: 169, height: 160 }]) {
        const image = await renderOutputRegion(file, region, 1, [], false)
        expect(pixels(image.canvas).equals(pixels(full.canvas, region.left, region.top, region.width, region.height)), `${kind} at ${region.left},${region.top}`).toBe(true)
      }
    }, 30_000) // Full native effect comparisons also run under coverage on shared CI CPUs.

  it('keeps revision borders at document edges, never at internal tile edges', async () => {
    const tree = buildLayerTree(makePsd({ children: [makeLayer({ name: '_sheet', canvas: paint(1103, 713) })] }))
    const file = { ...plan(tree), processSuffixes: ['_s'] }, table = [{ suffix: '_s', folderNames: ['修正'], borderColor: '#ff3311' }]
    const full = await renderOutputFileAsync(file, table, true)
    for (const region of [{ left: 0, top: 0, width: 129, height: 80 }, { left: 500, top: 300, width: 200, height: 200 }, { left: 1000, top: 650, width: 103, height: 63 }]) {
      const image = await renderOutputRegion(file, region, 1, table, true)
      expect(pixels(image.canvas).equals(pixels(full.canvas, region.left, region.top, region.width, region.height))).toBe(true)
    }
  })

  it('resolves deferred source coordinates without changing the original layer or pixels', async () => {
    const tree = buildLayerTree(makePsd({ children: [makeLayer({ name: '_sheet', left: 0, top: 0 })] })), ref = tree[0].agPsdRef
    delete ref.canvas
    const dispose = registerMaterial(ref, 100 * 80 * 4, async () => {
      ref.left = 511; ref.top = 255; ref.canvas = paint(100, 80)
      return { diagnostics: [] }
    })
    try {
      const file = plan(tree), full = await renderOutputFileAsync(file, [], false)
      const region = { left: 500, top: 250, width: 150, height: 120 }
      const image = await renderOutputRegion(file, region, 1, [], false)
      expect(pixels(image.canvas).equals(pixels(full.canvas, 500, 250, 150, 120))).toBe(true)
      expect(ref.left).toBe(511); expect((ref as { canvas?: HTMLCanvasElement }).canvas?.width).toBe(100)
    } finally { dispose() }
  })

  it('composites a huge document through small windows and cancels an obsolete overview', async () => {
    const tree = buildLayerTree(makePsd({ children: [makeLayer({ name: '_sheet', canvas: paint(32, 32), left: 15990, top: 11990 })] }))
    const file = plan(tree, 32000, 24000), render = file.preview!.render
    const windows: number[] = []
    file.preview = { ...file.preview!, render: region => { windows.push(region.width * region.height); return render(region) } }
    const image = await renderOutputRegion(file, { left: 15872, top: 11776, width: 512, height: 512 }, 1, [], false)
    expect(image.canvas.width).toBe(512)
    expect(pixels(image.canvas, 130, 220, 1, 1)[3]).toBe(255)
    await expect(renderOutputOverview(file, 16, [], false, [], () => windows.length >= 4)).rejects.toThrow('中止')
    expect(Math.max(...windows)).toBeLessThanOrEqual(768 * 768)
  })

  it('keeps all temporary composite dimensions independent of document size', () => {
    const sizes: number[] = []
    const preview = createRegionPreview([], 60000, 40000, (_tree, w, h) => {
      sizes.push(w * h)
      return paint(w, h)
    })
    const result = preview.render({ left: 30000, top: 20000, width: 512, height: 512 })
    expect(result.width).toBe(512)
    expect(sizes).toEqual([516 * 516])
  })

  it('keeps downsampled chunk boundaries uniform, including translucent pixels and partial edge chunks', async () => {
    const canvas = document.createElement('canvas'); canvas.width = 2305; canvas.height = 1537
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = 'rgba(90, 160, 220, .5)'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    const tree = buildLayerTree(makePsd({ children: [makeLayer({ name: '_sheet', canvas })] }))
    const file = plan(tree, canvas.width, canvas.height)
    const image = await renderOutputOverview(file, 513, [], false, [], () => false)
    const data = pixels(image.canvas), reference = data.subarray(0, 4)
    // Do not compare to another tiled render: a constant source must stay constant everywhere.
    let deviations = 0
    for (let i = 0; i < data.length; i += 4) if (!data.subarray(i, i + 4).equals(reference)) deviations++
    expect(reference[3]).toBeGreaterThanOrEqual(127)
    expect(reference[3]).toBeLessThanOrEqual(128)
    expect(deviations).toBe(0)
  })
})
