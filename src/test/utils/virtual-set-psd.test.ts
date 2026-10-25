import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { readPsd, writePsd, type Layer } from 'ag-psd'
import { buildLayerTree } from '../../engine/tree-builder'
import { createVirtualSetPsd, virtualSetPsdName } from '../../utils/virtual-set-psd'
import { readPsdFile } from '../../utils/psd-io'
import { disposeMaterials, registerMaterial } from '../../engine/material-cache'
import { buildMemberFlatsWithOverride } from '../../utils/virtual-set-utils'
import { resolveVirtualSetLayers } from '../../utils/virtual-set-tree'
import { compositeGroup } from '../../engine/compositor'
import { flattenToCanvas } from '../../engine/flatten'
import { buildClipLayerTree, clipRenderingSource } from '../../engine/clip-tree'
import { DEFAULT_PROJECT_SETTINGS } from '../../types'
import type { ClipDocument } from '../../utils/clip/types'
import type { MaterialEffects } from '../../types/rendering'
import type { VirtualSet } from '../../types'

beforeEach(() => {
  const original = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag, options) => tag === 'canvas'
    ? createCanvas(1, 1) as unknown as HTMLCanvasElement : original(tag, options))
})
afterEach(() => vi.restoreAllMocks())

function solid(name: string, color: string, extra: Partial<Layer> = {}): Layer {
  const canvas = createCanvas(2, 2), ctx = canvas.getContext('2d')
  ctx.fillStyle = color; ctx.fillRect(0, 0, 2, 2)
  return { name, canvas: canvas as unknown as HTMLCanvasElement, ...extra }
}
function virtual(ids: string[], updates: Partial<VirtualSet> = {}): VirtualSet {
  return { id: 'vs', name: '背景原図', insertionLayerId: null, insertionPosition: 'above',
    members: ids.map(layerId => ({ layerId, blendMode: null, opacity: null })),
    expandToAnimationCells: false, visibilityOverrides: {}, ...updates }
}
const pixels = (layer: Layer) => [...layer.imageData!.data]
const options = { width: 4, height: 4, dpiX: 144, dpiY: 144 }

function expectSameAppearance(actual: ArrayLike<number>, expected: Uint8ClampedArray) {
  let max = 0
  for (let i = 0; i < actual.length; i += 4) {
    max = Math.max(max, Math.abs(actual[i + 3] - expected[i + 3]))
    // Low-alpha unpremultiplied RGB varies on Canvas round trips; compare both backgrounds.
    for (const bg of [0, 255]) for (let c = 0; c < 3; c++) {
      const a = Math.round(actual[i + c] * actual[i + 3] / 255 + bg * (1 - actual[i + 3] / 255))
      const b = Math.round(expected[i + c] * expected[i + 3] / 255 + bg * (1 - expected[i + 3] / 255))
      max = Math.max(max, Math.abs(a - b))
    }
  }
  expect(max).toBeLessThanOrEqual(1)
}

describe('virtual cell PSD round trip', () => {
  it('exports only the edited tree with no wrapper, preserving names, order, metadata, hidden pixels and empty folders', async () => {
    const psd = { width: 4, height: 4, children: [solid('外側の用紙', '#ffffff'),
      { name: '元フォルダ', children: [solid('隠し素材', '#00ff00', { hidden: true }), solid('原図', '#ff0000', { left: 1, top: 1 })] }] }
    const tree = buildLayerTree(psd), folder = tree[0], [art, hidden] = folder.children
    const vs = virtual(['local', hidden.id], {
      insertionLayerId: tree[1].id,
      tree: [{ layerId: 'local', virtualFolder: true, name: '背景用', children: [{ layerId: art.id, name: '修正', children: [] },
        { layerId: 'empty', virtualFolder: true, name: '空', children: [] }] }, { layerId: hidden.id, children: [] }],
      layerOverrides: { local: { blendMode: 'multiply', opacity: 50 }, [art.id]: { blendMode: 'screen', opacity: 25 } },
    })
    const result = await createVirtualSetPsd(tree, vs, options)
    const restored = readPsd(result.buffer, { useImageData: true })
    expect(restored.children!.map(l => l.name)).toEqual(['隠し素材', '背景用'])
    expect(restored.children![1]).toMatchObject({ blendMode: 'multiply', opacity: 128 / 255 })
    const children = restored.children![1].children!
    expect(children.map(l => l.name)).toEqual(['空', '修正'])
    expect(children[0].children).toEqual([])
    expect(children[1]).toMatchObject({ blendMode: 'screen', opacity: 64 / 255, left: 1, top: 1 })
    expect(pixels(children[1]).slice(0, 4)).toEqual([255, 0, 0, 255])
    expect(restored.children![0].hidden).toBe(true)
    expect(pixels(restored.children![0]).slice(0, 4)).toEqual([0, 255, 0, 255])
    expect(restored.imageResources!.resolutionInfo!.horizontalResolution).toBe(144)
    expect(restored.imageData!.data[(1 * 4 + 1) * 4 + 3]).toBe(32)
    expect(result.warnings).toEqual([])
    expect(folder.originalName).toBe('元フォルダ')
    expect(art.originalName).toBe('原図')
    expect(art.agPsdRef.canvas!.width).toBe(2)
  })

  it('loads hidden deferred images and retains virtual visibility independently of source eyes', async () => {
    const source = readPsdFile(writePsd({ width: 4, height: 4, children: [solid('hidden', '#2468ac', { hidden: true })] }), true)
    const tree = buildLayerTree(source)
    expect(tree[0].agPsdRef.canvas).toBeUndefined()
    try {
      const result = await createVirtualSetPsd(tree, virtual([tree[0].id], { visibilityOverrides: { [tree[0].id]: true } }), options)
      const restored = readPsd(result.buffer, { useImageData: true })
      expect(restored.children![0].hidden).toBe(false)
      expect(pixels(restored.children![0]).slice(0, 4)).toEqual([36, 104, 172, 255])
      expect(tree[0].hidden).toBe(true)
    } finally { disposeMaterials(source) }
  })

  it('keeps all animation-folder children and folder opacity, including an unplaced virtual cell', async () => {
    const tree = buildLayerTree({ width: 4, height: 4, children: [{ name: 'A', opacity: .4,
      children: [solid('1', '#ff0000'), solid('2', '#00ff00', { hidden: true })] }] })
    tree[0].isAnimationFolder = true
    const result = await createVirtualSetPsd(tree, virtual([tree[0].id]), options)
    const layer = readPsd(result.buffer).children![0]
    expect(layer.children!.map(child => child.name)).toEqual(['1', '2'])
    expect(layer.opacity).toBeCloseTo(.4)
  })

  it('keeps folder and layer masks editable, with absolute positions after rasterizing leaf effects', async () => {
    const mask = solid('mask', '#ffffff').canvas!
    const tree = buildLayerTree({ width: 4, height: 4, children: [{ name: 'group', blendMode: 'normal',
      mask: { canvas: mask, defaultColor: 0, left: 1, top: 1 }, children: [solid('ink', '#000000', {
        left: 1, top: 1, mask: { canvas: mask, left: 0, top: 0, positionRelativeToLayer: true, defaultColor: 0 },
      })] }] })
    tree[0].children[0].materialEffects = { layerColor: { main: [0, 0, 255], sub: [255, 255, 255] } }
    const result = await createVirtualSetPsd(tree, virtual([tree[0].id]), options)
    const restored = readPsd(result.buffer, { useImageData: true }), group = restored.children![0], ink = group.children![0]
    expect(group.mask).toMatchObject({ left: 1, top: 1, defaultColor: 0 })
    expect(ink.mask).toMatchObject({ left: 1, top: 1, positionRelativeToLayer: false })
    expect(pixels(ink).slice(0, 4)).toEqual([0, 0, 255, 255])
    expect([...restored.imageData!.data].slice(20, 24)).toEqual([0, 0, 255, 255])
  })

  it('preserves clipping and supported adjustment layers instead of painting their helper images', async () => {
    const tree = buildLayerTree({ width: 4, height: 4, children: [solid('base', '#ff0000'),
      solid('clip', '#0000ff', { clipping: true }), { name: 'invert', adjustment: { type: 'invert' } }] })
    const result = await createVirtualSetPsd(tree, virtual(tree.map(l => l.id)), options)
    const restored = readPsd(result.buffer, { useImageData: true })
    expect(restored.children![1].clipping).toBe(true)
    expect(restored.children![2].adjustment).toEqual({ type: 'invert' })
    expect([...restored.imageData!.data].slice(0, 4)).toEqual([255, 255, 0, 255])
  })

  it.each<MaterialEffects>([
    { layerColor: { main: [0, 0, 255], sub: [255, 255, 255] } },
    { edge: { radius: 1, color: [0, 0, 255] } },
    { watercolor: { range: 2, opacity: 50, darkness: 20, blur: 1 } },
  ])('bakes the edited folder children with effects %j, without backup layers or changes to the source', async effects => {
    const mask = solid('mask', '#808080').canvas!
    const tree = buildLayerTree({ width: 4, height: 4, children: [
      { name: 'untouched', children: [] },
      solid('added', '#00ff00', { left: 1, top: 1, hidden: true }),
      { name: 'group', opacity: 128 / 255, blendMode: 'normal', mask: { canvas: mask, defaultColor: 255, left: 1, top: 1 },
        children: [solid('removed', '#ff0000'), solid('ink', 'rgba(0,0,0,0.5)')] },
    ] })
    const [group, added, untouched] = tree, [ink, removed] = group.children
    group.materialEffects = effects
    const vs = virtual([group.id, untouched.id], {
      tree: [{ layerId: group.id, name: '背景', children: [{ layerId: added.id, children: [] }, { layerId: ink.id, children: [] }] },
        { layerId: untouched.id, children: [] }],
      visibilityOverrides: { [added.id]: true }, layerOverrides: { [added.id]: { opacity: 128 / 255 * 100, blendMode: 'multiply' } },
    })
    const expected = compositeGroup(buildMemberFlatsWithOverride(vs.members, resolveVirtualSetLayers(tree, vs), 4, 4,
      vs.visibilityOverrides, vs.layerOverrides), 4, 4).getContext('2d')!.getImageData(0, 0, 4, 4).data
    const result = await createVirtualSetPsd(tree, vs, options), restored = readPsd(result.buffer, { useImageData: true })
    expect(result.warnings.join('')).toContain('「背景」のフォルダ効果を焼き込み')
    expect(restored.children!.map(l => l.name)).toEqual(['untouched', '背景'])
    expect(restored.children![0].children).toEqual([])
    expect(restored.children![1].children).toBeUndefined()
    expect(restored.children![1]).toMatchObject({ opacity: 128 / 255, blendMode: 'normal', mask: { left: 1, top: 1 } })
    const reopened = flattenToCanvas(buildLayerTree(readPsd(result.buffer)), 4, 4, 'transparent').getContext('2d')!.getImageData(0, 0, 4, 4).data
    for (const actual of [restored.imageData!.data, reopened]) expectSameAppearance(actual, expected)
    expect(group.children.map(l => l.id)).toEqual([ink.id, removed.id])
    expect(added.hidden).toBe(true)
    expect(group.originalName).toBe('group')
    expect([...ink.agPsdRef.canvas!.getContext('2d')!.getImageData(0, 0, 1, 1).data]).toEqual([0, 0, 0, 128])
  })

  it('bakes nested effects and all animation children, preserves outer masks/opacity, and normalizes pass-through pixel layers', async () => {
    const tree = buildLayerTree({ width: 4, height: 4, children: [{ name: 'outer', blendMode: 'pass through',
      children: [{ name: 'animation', opacity: 128 / 255, blendMode: 'normal', children: [
        solid('1', '#000000'), solid('2', '#000000', { left: 2 }),
      ] }] }] })
    const outer = tree[0], animation = outer.children[0]
    outer.materialEffects = { layerColor: { main: [0, 255, 0], sub: [255, 255, 255] } }
    animation.isAnimationFolder = true
    animation.materialEffects = { layerColor: { main: [0, 0, 255], sub: [255, 255, 255] } }
    const result = await createVirtualSetPsd(tree, virtual([outer.id]), options)
    const restored = readPsd(result.buffer, { useImageData: true }), output = restored.children![0]
    expect(output.children).toBeUndefined()
    expect(output.blendMode).toBe('normal')
    for (const x of [0, 2]) expectSameAppearance(restored.imageData!.data.slice(x * 4, x * 4 + 4), new Uint8ClampedArray([29, 255, 29, 128]))
    expect(animation.children).toHaveLength(2)
  })

  it('bakes supported adjustments and clipping, and refuses unknown adjustments inside an effect folder', async () => {
    const tree = buildLayerTree({ width: 4, height: 4, children: [{ name: 'group', children: [
      solid('base', '#000000'), solid('clip', '#ff0000', { clipping: true }), { name: 'invert', adjustment: { type: 'invert' } },
    ] }] })
    tree[0].materialEffects = { layerColor: { main: [0, 0, 255], sub: [255, 255, 255] } }
    const result = await createVirtualSetPsd(tree, virtual([tree[0].id]), options)
    expect([...readPsd(result.buffer, { useImageData: true }).imageData!.data].slice(0, 4)).toEqual([178, 178, 255, 255])
    tree[0].children[0].agPsdRef.adjustment = { type: 'brightness/contrast', brightness: 10, contrast: 0 }
    await expect(createVirtualSetPsd(tree, virtual([tree[0].id]), options)).rejects.toThrow('色調補正を含むフォルダ')
  })

  it('retains positioned pixels when a zero-radius effect allocates a document canvas', async () => {
    const tree = buildLayerTree({ width: 4, height: 4, children: [solid('ink', '#2468ac', { left: 1, top: 1 })] })
    tree[0].materialEffects = { edge: { radius: 0, color: [0, 0, 0] } }
    const result = await createVirtualSetPsd(tree, virtual([tree[0].id]), options)
    const layer = readPsd(result.buffer, { useImageData: true }).children![0]
    expect(layer).toMatchObject({ left: 1, top: 1, right: 3, bottom: 3 })
    expect(pixels(layer).slice(0, 4)).toEqual([36, 104, 172, 255])
  })

  it('exports transformed CLIP image materials and cached 3D as independent raster layers', async () => {
    const doc: ClipDocument = { width: 4, height: 4, dpi: 144, diagnostics: [], timelines: [], defaultTimelineId: null,
      layers: ['image-material', '3d'].map((kind, index) => ({ id: String(index), name: kind, kind: kind as 'image-material' | '3d',
        isFolder: false, isAnimationFolder: false, expanded: true, hidden: false, opacity: 1, blendMode: 'normal', clipping: false, children: [],
        pixels: { width: 1, height: 1, left: 0, top: 0, rgba: new Uint8ClampedArray([32, 64, 128, 255]) },
        ...(index === 0 ? { placement: [1, 1, 3, 1, 3, 3, 1, 3] as [number, number, number, number, number, number, number, number] } : {}),
      })) }
    const tree = buildClipLayerTree(doc, clipRenderingSource(doc), undefined, DEFAULT_PROJECT_SETTINGS, false)
    const result = await createVirtualSetPsd(tree, virtual(tree.map(l => l.id)), options)
    const layers = readPsd(result.buffer, { useImageData: true }).children!
    expect(layers.map(l => l.name)).toEqual(['3d', 'image-material'])
    expect(layers[1]).toMatchObject({ left: 1, top: 1, right: 3, bottom: 3 })
    for (const output of layers) expect(pixels(output).slice(0, 4)).toEqual([32, 64, 128, 255])
    expect(result.warnings).toEqual([])
  })

  it('fails on missing material, stale references, cancellation and unsupported PSD dimensions', async () => {
    const tree = buildLayerTree({ width: 4, height: 4, children: [solid('ink', '#000000')] }), vs = virtual([tree[0].id])
    await expect(createVirtualSetPsd(tree, vs, { ...options, cancelled: () => true })).rejects.toThrow('中止')
    await expect(createVirtualSetPsd(tree, vs, { width: 30001, height: 1 })).rejects.toThrow('30,000')
    await expect(createVirtualSetPsd(tree, virtual(['missing']), options)).rejects.toThrow('レイヤー')
    tree[0].vectorRendering = 'unavailable'
    await expect(createVirtualSetPsd(tree, vs, options)).rejects.toThrow('「ink」の描画画像を取得できません')
    delete tree[0].vectorRendering
    const dispose = registerMaterial(tree[0].agPsdRef, 16, async () => { throw new Error('decode failure') })
    try { await expect(createVirtualSetPsd(tree, vs, options)).rejects.toThrow('decode failure') } finally { dispose() }
  })

  it('uses a portable PSD filename with one extension and a bounded byte length', () => {
    expect(virtualSetPsdName('背景/原図.psd')).toBe('背景_原図.psd')
    expect(virtualSetPsdName('  ')).toBe('仮想セル.psd')
    expect(virtualSetPsdName('CON')).toBe('_CON.psd')
    const name = virtualSetPsdName('原図'.repeat(200))
    expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(255)
    expect(name.endsWith('.psd')).toBe(true)
  })
})
