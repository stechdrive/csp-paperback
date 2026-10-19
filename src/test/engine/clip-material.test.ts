import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createCanvas as napiCanvas } from '@napi-rs/canvas'
import { readTextObjects } from '../../utils/clip/text'
import { createMaterialDecoder, readMaterialEffects, readMaterialQuad, type MaterialTables } from '../../utils/clip/material'
import { readGradient } from '../../utils/clip/gradient'
import { readAdjustment } from '../../utils/clip/adjustment'
import { cropPixels } from '../../utils/clip/pixels'
import { placeMaterial, renderClipMaterial } from '../../engine/material-image'
import { buildClipLayerTree, clipRenderingSource } from '../../engine/clip-tree'
import { flattenToCanvas } from '../../engine/flatten'
import { compositeStack } from '../../engine/compositor'
import { buildMemberFlatsWithOverride } from '../../utils/virtual-set-utils'
import { DEFAULT_PROJECT_SETTINGS, type FlatLayer } from '../../types'
import type { ClipDiagnostic, ClipDocument, ClipLayer, ClipPixels } from '../../utils/clip/types'
import { hasVectorWarning, hasUnsupported3D } from '../../engine/render-warning'
import { extractCells } from '../../engine/cell-extractor'
import { createRevisionBorderCanvas } from '../../utils/revision-border'

const createElement = document.createElement.bind(document)
beforeAll(() => {
  document.createElement = ((tag: string, options?: ElementCreationOptions) => tag === 'canvas' ? napiCanvas(1, 1) as unknown as HTMLCanvasElement : createElement(tag, options)) as typeof document.createElement
})
afterAll(() => { document.createElement = createElement })

const join = (...bytes: Uint8Array[]) => new Uint8Array(Buffer.concat(bytes))
const u32 = (n: number, le = false) => { const b = Buffer.alloc(4); if (le) b.writeUInt32LE(n); else b.writeUInt32BE(n); return b }
const f64 = (n: number, le = false) => { const b = Buffer.alloc(8); if (le) b.writeDoubleLE(n); else b.writeDoubleBE(n); return b }
const wide = (s: string) => join(u32(s.length), new Uint8Array(Buffer.from(s, 'utf16le').swap16()))
const tlv = (id: number, data: Uint8Array) => join(u32(id, true), u32(data.length, true), data)
const layer = (id = 'material'): ClipLayer => ({ id, name: id, isFolder: false, isAnimationFolder: false, expanded: true, hidden: false, opacity: 1, blendMode: 'normal', clipping: false, children: [] })
const pixel = (canvas: HTMLCanvasElement, x: number, y: number) => [...canvas.getContext('2d')!.getImageData(x, y, 1, 1).data]
const tables = (): MaterialTables => ({ mipmaps: new Map(), mipInfos: new Map(), offscreens: new Map(), thumbnails: [], external: new Map() })
const solid = (width: number, height: number, rgba: number[], left = 0, top = 0): ClipPixels => ({ width, height, left, top, rgba: new Uint8ClampedArray(Array.from({ length: width * height }, () => rgba).flat()) })
const clip = (layers: ClipLayer[], width = 8, height = 4): ClipDocument => ({ width, height, dpi: 72, layers, timelines: [], defaultTimelineId: null, diagnostics: [] })

describe('CLIP rendering source memory', () => {
  it('shares immutable adjustment coverage, keeping separate masks and identical output', () => {
    const adjustments = Array.from({ length: 8 }, (_, i) => ({ ...layer(String(i)), adjustment: { kind: 'invert' as const } }))
    adjustments[0] = { ...adjustments[0], mask: solid(8, 4, [255, 255, 255, 128]) } as typeof adjustments[0]
    const doc = clip([...adjustments, { ...layer('ink'), pixels: solid(8, 4, [32, 64, 128, 255]) }])
    const source = clipRenderingSource(doc)
    expect(new Set(source.children!.slice(1).map(l => l.canvas)).size).toBe(1)
    const legacy = { width: 8, height: 4, children: source.children!.map(l => ({ ...l,
      canvas: l.name === 'ink' ? l.canvas : renderClipMaterial(adjustments[0], 8, 4)!.canvas })) }
    const render = (psd: typeof source) => flattenToCanvas(buildClipLayerTree(doc, psd, undefined, DEFAULT_PROJECT_SETTINGS, false), 8, 4)
    const pixels = (c: HTMLCanvasElement) => [...c.getContext('2d')!.getImageData(0, 0, 8, 4).data]
    expect(pixels(render(source))).toEqual(pixels(render(legacy)))
  })

  it('counts post-decode full-document canvases and masks before allocating them', () => {
    const create = vi.spyOn(document, 'createElement').mockImplementation(() => { throw Error('unexpected allocation') })
    try {
      const text = { text: '', left: 0, top: 0, width: 1, height: 1, size: 12, font: 'sans-serif', color: [0, 0, 0] as [number, number, number], runs: [], align: 'left' as const }
      const layers = Array.from({ length: 9 }, (_, i) => ({ ...layer(String(i)), text: [text] }))
      expect(() => clipRenderingSource(clip(layers, 4096, 4096))).toThrow('512 MiB')
      expect(create).not.toHaveBeenCalled()
    } finally { create.mockRestore() }
  })
})

describe('vector warnings follow material contributions', () => {
  it('does not warn for layer color, borders or masks alone; warns only for explicitly unsupported 3D without a cache', async () => {
    const effects = { layerColor: { main: [0, 0, 255] as [number, number, number], sub: [255, 255, 255] as [number, number, number] }, edge: { radius: 1, color: [0, 0, 0] as [number, number, number] } }
    const raster = { ...layer(), effects, pixels: solid(1, 1, [0, 0, 0, 255], 2, 2), mask: solid(8, 4, [255, 255, 255, 255]) }
    const doc = clip([raster]), tree = buildClipLayerTree(doc, clipRenderingSource(doc), undefined, DEFAULT_PROJECT_SETTINGS, false)
    const image = flattenToCanvas(tree, 8, 4)
    expect(hasVectorWarning(image) || hasUnsupported3D(image)).toBe(false)
    const model = { ...layer('model'), kind: '3d' as const }, cached = { ...model, pixels: solid(1, 1, [0, 0, 0, 255]) }
    const diagnostics: ClipDiagnostic[] = []
    const decode = createMaterialDecoder(tables(), 8, 4, 72, diagnostics)
    await decode(model, { Manager3DOd: 1 })
    await decode(cached, { Manager3DOd: 1 })
    expect(model.unsupported3D).toBe(true)
    expect(cached.unsupported3D).toBeUndefined()
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].message).toContain('［バージョン互換情報の保存］を［保存する］')
    expect(diagnostics[0].message).toContain('CLIPを保存し直して、再度読み込んでください')
    const d = clip([model]), unpaired = buildClipLayerTree(d, clipRenderingSource(d), undefined, DEFAULT_PROJECT_SETTINGS, false)
    const missing = flattenToCanvas(unpaired, 8, 4, 'transparent')
    expect(hasUnsupported3D(missing)).toBe(true)
    expect(hasVectorWarning(missing)).toBe(false)
    expect([missing.width, missing.height]).toEqual([8, 4])
    expect([...missing.getContext('2d')!.getImageData(0, 0, 8, 4).data].every(v => v === 0)).toBe(true)
    expect([...flattenToCanvas(unpaired, 8, 4, 'white').getContext('2d')!.getImageData(0, 0, 8, 4).data].every(v => v === 255)).toBe(true)
  })
  it('tracks selected cels through effects and masks, excludes hidden/zero-opacity layers, and clears after PSD pairing', () => {
    const vector = { ...layer('vector'), vectorRendering: 'approximate' as const, pixels: solid(2, 2, [0, 0, 0, 200]) }
    const raster = { ...layer('raster'), pixels: solid(2, 2, [0, 0, 0, 200]) }
    const animation = { ...layer('animation'), isFolder: true, isAnimationFolder: true, children: [vector, raster],
      effects: { layerColor: { main: [0, 0, 255] as [number, number, number], sub: [255, 255, 255] as [number, number, number] } }, mask: solid(8, 4, [255, 255, 255, 255]) }
    const doc = clip([animation]), source = clipRenderingSource(doc)
    const tree = buildClipLayerTree(doc, source, undefined, DEFAULT_PROJECT_SETTINGS, false)
    expect(hasVectorWarning(flattenToCanvas(tree, 8, 4, 'transparent', new Map([['clip:animation', 0]])))).toBe(true)
    expect(hasVectorWarning(flattenToCanvas(tree, 8, 4, 'transparent', new Map([['clip:animation', 1]])))).toBe(false)
    const entries = extractCells(tree[0], DEFAULT_PROJECT_SETTINGS, 8, 4, [])
    expect(entries.map(e => hasVectorWarning(e.canvas))).toEqual([true, false])
    const vectorCanvas = entries.find(e => hasVectorWarning(e.canvas))!.canvas
    expect(hasVectorWarning(createRevisionBorderCanvas(vectorCanvas, '#ff0000'))).toBe(true)
    const virtual = compositeStack(buildMemberFlatsWithOverride([{ layerId: 'clip:vector', blendMode: null, opacity: null }], [tree[0].children[0]], 8, 4), 8, 4)
    expect(hasVectorWarning(virtual)).toBe(true)
    tree[0].children[0].uiHidden = true
    expect(hasVectorWarning(flattenToCanvas(tree, 8, 4))).toBe(false)
    tree[0].children[0].uiHidden = false; tree[0].children[0].opacity = 0
    expect(hasVectorWarning(flattenToCanvas(tree, 8, 4))).toBe(false)
    const paired = buildClipLayerTree(doc, source, undefined, DEFAULT_PROJECT_SETTINGS, true)
    expect(paired[0].children[0].vectorRendering).toBeUndefined()
    expect(hasVectorWarning(flattenToCanvas(paired, 8, 4))).toBe(false)
  })
})

describe('CLIP text material recovery', () => {
  it('reads primary and array text objects, position, font size, color and character runs', () => {
    const run = join(u32(1, true), u32(1, true), u32(1, true), u32(28, true),
      new Uint8Array(2), new Uint8Array([0, 255, 0, 0, 0, 0]), f64(150, true), new Uint8Array([1, 0]), Buffer.from('X', 'utf16le'))
    const attrs = join(tlv(31, Buffer.from('Test Font')), tlv(32, u32(1800, true)),
      tlv(34, join(u32(0xff000000, true), u32(0, true), u32(0, true))),
      tlv(42, join(...[5, 6, 104, 45].map(v => u32(v, true)))), tlv(11, run))
    const texts = readTextObjects({ TextLayerString: 'AB', TextLayerAttributes: attrs,
      TextLayerStringArray: join(u32(1, true), Buffer.from('C')), LayerOffsetX: 2, LayerOffsetY: 3 }, 144)
    expect(texts[0]).toMatchObject({ text: 'AB', left: 7, top: 9, width: 100, height: 40, size: 36, font: 'Test Font', color: [255, 0, 0] })
    expect(texts[0].runs).toEqual([{ start: 1, length: 1, font: 'X', size: 54, color: [255, 0, 0] }])
    expect(texts[1]).toMatchObject({ text: 'C', left: 2, top: 3, width: 0, size: 24 })
  })

  it('draws text without a saved raster or installed font, while another layer still renders', async () => {
    const diagnostics: ClipDiagnostic[] = [], decode = createMaterialDecoder(tables(), 100, 40, 72, diagnostics)
    const text = layer('text'), fill = layer('fill'), bad = layer('unknown')
    const attrs = join(tlv(31, Buffer.from('Unavailable Font Paperback Test')), tlv(32, u32(2200, true)))
    await decode(text, { TextLayerString: 'ABC', TextLayerAttributes: attrs, LayerType: 4, LayerOffsetX: 2 })
    await decode(bad, { LayerType: 4096 })
    await decode(fill, { DrawColorEnable: 1, DrawColorMainRed: 0xffffffff, LayerType: 1584 })
    expect(text.materialSource).toBe('text')
    const rendered = renderClipMaterial(text, 100, 40)!
    const data = rendered.canvas.getContext('2d')!.getImageData(0, 0, 100, 40).data
    expect(data.filter((value, i) => i % 4 === 3 && value > 0).length).toBeGreaterThan(60)
    expect(fill.pixels?.rgba.slice(0, 4)).toEqual(new Uint8ClampedArray([255, 0, 0, 255]))
    expect(diagnostics.map(d => d.layerId)).toEqual(['text', 'unknown'])
  })

  it('retains text with malformed attributes and composites recovered fragments with fallback text', () => {
    const reports: string[] = []
    const text = readTextObjects({ TextLayerString: 'A', TextLayerAttributes: tlv(42, new Uint8Array(1)), LayerOffsetX: 10 }, 72, message => reports.push(message))
    expect(reports).toHaveLength(1)
    const canvas = renderClipMaterial({ ...layer(), text, fragments: [solid(1, 1, [255, 0, 0, 255], 1, 1)] }, 40, 25)!.canvas
    expect(pixel(canvas, 1, 1)).toEqual([255, 0, 0, 255])
    expect(canvas.getContext('2d')!.getImageData(10, 0, 30, 25).data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true)
  })

  it('preserves character styling after Windows line breaks', () => {
    const [text] = readTextObjects({ TextLayerString: 'A\r\nB' }, 72)
    text.runs = [{ start: 3, length: 1, font: 'sans-serif', size: 12, color: [255, 0, 0] }]
    const canvas = renderClipMaterial({ ...layer(), text: [text] }, 30, 40)!.canvas
    const secondLine = canvas.getContext('2d')!.getImageData(0, 14, 30, 20).data
    expect(secondLine.some((v, i) => i % 4 === 0 && v === 255 && secondLine[i + 3] > 0)).toBe(true)
  })
})

describe('static material placement and selected-cel effects', () => {
  it('crops sparse images and masks without losing document offsets or default mask coverage', () => {
    const rgba = new Uint8ClampedArray(100 * 100 * 4)
    rgba.set([255, 0, 0, 255], (30 * 100 + 20) * 4)
    const cropped = cropPixels({ width: 100, height: 100, rgba, left: -10, top: 5 })
    expect([cropped.width, cropped.height, cropped.left, cropped.top]).toEqual([1, 1, 10, 35])
    const mask = solid(100, 100, [255, 255, 255, 255])
    mask.defaultColor = 255
    mask.rgba.set([0, 0, 0, 255], (40 * 100 + 50) * 4)
    const croppedMask = cropPixels(mask, true)
    expect([croppedMask.width, croppedMask.height, croppedMask.left, croppedMask.top, croppedMask.defaultColor]).toEqual([1, 1, 50, 40, 255])
    expect(cropPixels(solid(100, 100, [0, 0, 0, 0])).rgba.length).toBe(4)
  })
  it('places original image materials, including perspective and negative document positions', () => {
    const pixels = solid(2, 2, [40, 80, 120, 255])
    const info = join(u32(120), new Uint8Array(116), ...[-2, 1, 2, 1, -2, 5, 2, 5].map(n => f64(n)))
    const placed = placeMaterial(pixels, readMaterialQuad(info))
    expect([placed.left, placed.top, placed.canvas.width, placed.canvas.height]).toEqual([-2, 1, 4, 4])
    expect(pixel(placed.canvas, 2, 2)).toEqual([40, 80, 120, 255])
    const perspective = placeMaterial(pixels, [0, 0, 4, 0, 3, 4, 1, 4])
    expect(pixel(perspective.canvas, 0, 3)[3]).toBe(0)
    expect(pixel(perspective.canvas, 2, 3)).toEqual([40, 80, 120, 255])
  })

  it('applies a folder border only to the selected cel and never reapplies it to PSD pixels', () => {
    const effects = readMaterialEffects({ LayerEffectAttached: 1, LayerEffectInfo: join(wide('EffectEdge'), u32(1), f64(1), u32(0xffffffff), u32(0xffffffff), u32(0xffffffff)) })
    const animation = { ...layer('anim'), isFolder: true, isAnimationFolder: true, effects,
      children: [{ ...layer('one'), pixels: solid(1, 1, [0, 0, 0, 255], 2, 1) }, { ...layer('two'), pixels: solid(1, 1, [255, 0, 0, 255], 6, 1) }] }
    const doc = clip([animation]), source = clipRenderingSource(doc)
    const tree = buildClipLayerTree(doc, source, undefined, DEFAULT_PROJECT_SETTINGS, false)
    const image = flattenToCanvas(tree, 8, 4, 'transparent', new Map([['clip:anim', 0]]))
    expect(pixel(image, 2, 1)).toEqual([0, 0, 0, 255])
    expect(pixel(image, 1, 1).slice(0, 3)).toEqual([255, 255, 255])
    expect(pixel(image, 6, 1)[3]).toBe(0)
    const paired = buildClipLayerTree(doc, source, undefined, DEFAULT_PROJECT_SETTINGS, true)
    expect(pixel(flattenToCanvas(paired, 8, 4, 'transparent'), 1, 1)[3]).toBe(0)
    const virtual = compositeStack(buildMemberFlatsWithOverride([{ layerId: 'clip:anim', blendMode: null, opacity: null }], tree, 8, 4), 8, 4, 'transparent')
    expect(pixel(virtual, 1, 1)).toEqual(pixel(image, 1, 1))
  })

  it('honors masks after a material border without shifting the artwork', () => {
    const material = { ...layer(), pixels: solid(1, 1, [0, 0, 0, 255], 3, 1), effects: { edge: { radius: 2, color: [255, 255, 255] as [number, number, number] } }, mask: solid(4, 4, [255, 255, 255, 255]) }
    const doc = clip([material]), tree = buildClipLayerTree(doc, clipRenderingSource(doc), undefined, DEFAULT_PROJECT_SETTINGS, false)
    const result = flattenToCanvas(tree, 8, 4, 'transparent')
    expect(pixel(result, 3, 1)).toEqual([0, 0, 0, 255])
    expect(pixel(result, 2, 1)).toEqual([255, 255, 255, 255])
    expect(pixel(result, 4, 1)[3]).toBe(0)
  })
})

describe('CLIP compositing fallbacks', () => {
  it('distinguishes addition from glow at partial opacity, and keeps PSD behavior', () => {
    const flat = (rgba: number[], nativeBlendMode?: number): FlatLayer => ({ canvas: renderClipMaterial({ ...layer(), pixels: solid(1, 1, rgba) }, 1, 1)!.canvas,
      left: 0, top: 0, opacity: 100, blendMode: nativeBlendMode ? 'linear dodge' : 'normal', sourceId: '', clipping: false, nativeBlendMode })
    const base = flat([100, 100, 100, 255]), top = { ...flat([200, 200, 200, 255], 11), opacity: 50 }
    expect(pixel(compositeStack([base, top], 1, 1, 'transparent'), 0, 0)).toEqual([178, 178, 178, 255])
    expect(pixel(compositeStack([base, { ...top, nativeBlendMode: 12 }], 1, 1, 'transparent'), 0, 0)).toEqual([200, 200, 200, 255])
    expect(pixel(compositeStack([base, { ...top, nativeBlendMode: undefined }], 1, 1, 'transparent'), 0, 0)[0]).toBeCloseTo(150, 0)
  })

  it('applies inversion with mask and opacity to the current stack, preserving its alpha', () => {
    const base = { ...layer('base'), pixels: solid(4, 1, [40, 80, 120, 255]) }
    const adjustment = { ...layer('adjust'), adjustment: readAdjustment(join(u32(6), u32(0))), opacity: 0.5,
      mask: solid(2, 1, [255, 255, 255, 255]) }
    const doc = clip([adjustment, base], 4, 1), tree = buildClipLayerTree(doc, clipRenderingSource(doc), undefined, DEFAULT_PROJECT_SETTINGS, false)
    const result = flattenToCanvas(tree, 4, 1, 'transparent')
    expect(pixel(result, 0, 0)).toEqual([128, 128, 128, 255])
    expect(pixel(result, 3, 0)).toEqual([40, 80, 120, 255])
    expect(readAdjustment(join(u32(8), u32(4), u32(127)))).toEqual({ kind: 'threshold', threshold: 127 })
  })

  it('recovers a basic gradient and keeps unsupported corrections nonblocking', async () => {
    const stops = join(u32(0), u32(0), u32(2), u32(0), ...[0, 32768].map(position => join(u32(position ? 0xffffffff : 0), u32(0), u32(0), u32(0xffffffff), u32(0), u32(position), u32(0))))
    const bytes = join(new Uint8Array(8), wide('GradationData'), u32(stops.length), stops, wide('GradationSetting'),
      u32(0), u32(0), u32(1), ...[8, 8, 0, 0, 0, 4, 0].map(n => f64(n)))
    const image = readGradient(bytes, 4, 1, 0, 0, () => {})
    expect([...image.rgba]).toEqual([32, 0, 0, 255, 96, 0, 0, 255, 159, 0, 0, 255, 223, 0, 0, 255])
    const diagnostics: ClipDiagnostic[] = [], decode = createMaterialDecoder(tables(), 4, 1, 72, diagnostics)
    const bad = layer(), gradient = layer('gradient')
    await decode(bad, { FilterLayerInfo: join(u32(77), u32(0)) })
    await decode(gradient, { GradationFillInfo: bytes, LayerType: 1584 })
    expect(gradient.materialSource).toBe('gradient')
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].message).toContain('色調補正 77')
  })
})
