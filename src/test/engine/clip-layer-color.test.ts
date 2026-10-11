import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readMaterialEffects, createMaterialDecoder } from '../../utils/clip/material'
import type { ClipRow } from '../../utils/clip/records'
import type { ClipDocument, ClipLayer, ClipPixels, ClipDiagnostic } from '../../utils/clip/types'
import { buildClipLayerTree, clipRenderingSource } from '../../engine/clip-tree'
import { flattenToCanvas } from '../../engine/flatten'
import { extractAllEntries, extractMarkedLayers, extractVirtualSetEntries } from '../../engine/cell-extractor'
import { applyLayerColor } from '../../engine/material-effects'
import { compositeStack } from '../../engine/compositor'
import { buildMemberFlatsWithOverride } from '../../utils/virtual-set-utils'
import { useOutputPreview } from '../../hooks/useOutputPreview'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS, type VirtualSet } from '../../types'
import type { MaterialEffects } from '../../types/rendering'

interface SavedPixels extends Omit<ClipPixels, 'rgba'> { file: string }
interface SavedLayer extends Omit<ClipLayer, 'pixels' | 'mask' | 'children'> {
  pixels?: SavedPixels
  mask?: SavedPixels
  children: SavedLayer[]
  fields: ClipRow
  edge?: string
}
interface Fixture { name: string; reference: string; width: number; height: number; dpi: number; layers: SavedLayer[] }
const fixtureDir = 'testdata/layer-color/'
const fixtures = JSON.parse(readFileSync(fixtureDir + 'manifest.json', 'utf8')) as Fixture[]
const settings = { ...DEFAULT_PROJECT_SETTINGS, cellNamingMode: 'cellname' as const, processTable: [], archivePatterns: [], autoMarkFolderNames: [] }
const createElement = document.createElement.bind(document)
const storeBefore = useAppStore.getState()
beforeAll(() => {
  document.createElement = ((tag: string, options?: ElementCreationOptions) => tag === 'canvas' ? createCanvas(1, 1) as unknown as HTMLCanvasElement : createElement(tag, options)) as typeof document.createElement
})
afterEach(() => { cleanup(); useAppStore.setState(storeBefore, true) })
afterAll(() => { document.createElement = createElement })

function restore(f: Fixture): ClipDocument {
  const pixels = (p: SavedPixels | undefined): ClipPixels | undefined => p && { ...p, rgba: new Uint8ClampedArray(gunzipSync(readFileSync(fixtureDir + p.file))) }
  const layer = (l: SavedLayer): ClipLayer => ({ ...l, pixels: pixels(l.pixels), mask: pixels(l.mask),
    effects: readMaterialEffects({ ...l.fields, LayerEffectInfo: l.edge ? new Uint8Array(Buffer.from(l.edge, 'base64')) : null }), children: l.children.map(layer) })
  return { width: f.width, height: f.height, dpi: f.dpi, layers: f.layers.map(layer), timelines: [], defaultTimelineId: null, diagnostics: [] }
}
const treeFor = (doc: ClipDocument, paired = false) => buildClipLayerTree(doc, clipRenderingSource(doc), undefined, settings, paired)
const data = (c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
const pixel = (c: HTMLCanvasElement, x: number, y = 0) => [...c.getContext('2d')!.getImageData(x, y, 1, 1).data]
async function nativeImage(f: Fixture, white = true) {
  const c = createCanvas(f.width, f.height), ctx = c.getContext('2d')
  if (white) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, f.width, f.height) }
  ctx.drawImage(await loadImage(readFileSync(fixtureDir + f.reference)), 0, 0)
  return ctx.getImageData(0, 0, f.width, f.height).data
}
function expectWithinOne(actual: Uint8ClampedArray, expected: Uint8ClampedArray) {
  expect(actual.length).toBe(expected.length)
  let max = 0
  for (let i = 0; i < actual.length; i++) max = Math.max(max, Math.abs(actual[i] - expected[i]))
  expect(max).toBeLessThanOrEqual(1)
}
const layer = (id: string, extra: Partial<ClipLayer> = {}): ClipLayer => ({ id, name: id, isFolder: false, isAnimationFolder: false,
  expanded: true, hidden: false, opacity: 1, blendMode: 'normal', clipping: false, children: [], ...extra })
const solid = (rgba: number[], width = 1, left = 0): ClipPixels => ({ width, height: 1, left, top: 0,
  rgba: new Uint8ClampedArray(Array.from({ length: width }, () => rgba).flat()) })
const group = (id: string, children: ClipLayer[], extra: Partial<ClipLayer> = {}) => layer(id, { isFolder: true, children, ...extra })
const documentFor = (layers: ClipLayer[]): ClipDocument => ({ width: 4, height: 1, dpi: 72, layers, timelines: [], defaultTimelineId: null, diagnostics: [] })
const green: MaterialEffects = { layerColor: { main: [30, 200, 80], sub: [120, 100, 70] } }

describe('native CSP layer-color references', () => {
  it.each(fixtures)('$name matches the native saved preview, including masks and nested effects', async f => {
    const doc = restore(f)
    expectWithinOne(data(flattenToCanvas(treeFor(doc), doc.width, doc.height)), await nativeImage(f))
  })

  it.each(fixtures.slice(1, 4))('$name preserves alpha and matches native opaque RGB ramps', async f => {
    const source = restore(f).layers[0], actual = source.pixels!.rgba.slice(), original = actual.slice()
    applyLayerColor(actual, source.effects!.layerColor!)
    const expected = await nativeImage(f, false)
    let max = 0, alphaMismatch = 0, transparentMismatch = 0
    for (let i = 0; i < actual.length; i += 4) {
      if (actual[i + 3] !== original[i + 3] || actual[i + 3] !== expected[i + 3]) alphaMismatch++
      for (let c = 0; c < 3; c++) {
        if (actual[i + 3] === 255) max = Math.max(max, Math.abs(actual[i + c] - expected[i + c]))
        if (!actual[i + 3] && actual[i + c] !== original[i + c]) transparentMismatch++
      }
    }
    expect(max).toBeLessThanOrEqual(1)
    expect(alphaMismatch).toBe(0)
    expect(transparentMismatch).toBe(0)
  })

  it.each(['animation', 'cell', 'process', 'ancestor'])('keeps native folder/mask effects when used as a %s container', async position => {
    const f = fixtures.find(f => f.name === '11-nested-color-edge')!, doc = restore(f)
    const folder = doc.layers[0], unused = layer('unused', { pixels: solid([255, 0, 0, 255], 4) })
    let animation: ClipLayer
    if (position === 'animation') {
      animation = { ...folder, isAnimationFolder: true, children: [group('1', folder.children), unused] }
      doc.layers = [animation]
    } else if (position === 'ancestor') {
      animation = group('A', [group('1', folder.children), unused], { isAnimationFolder: true })
      doc.layers = [{ ...folder, opacity: 0.2, children: [animation] }]
    } else {
      const cel = position === 'cell' ? folder : group('1', [folder])
      animation = group('A', [cel, unused], { isAnimationFolder: true })
      doc.layers = [animation]
    }
    const project = position === 'process' ? { ...settings, processTable: [{ folderNames: [folder.name], suffix: '_p' }] } : settings
    const tree = treeFor(doc)
    const entries = extractAllEntries(tree, project, doc.width, doc.height)
    expect(entries).toHaveLength(2)
    expectWithinOne(data(entries[0].canvas), await nativeImage(f))
    expectWithinOne(data(flattenToCanvas(tree, doc.width, doc.height, 'white', new Map([[`clip:${animation.id}`, 0]]))), await nativeImage(f))
    if (position === 'ancestor') {
      const virtual = compositeStack(buildMemberFlatsWithOverride([{ layerId: tree[0].id, opacity: null, blendMode: null }], tree, doc.width, doc.height), doc.width, doc.height)
      expectWithinOne(data(virtual), await nativeImage(f))
    }
  })
})

describe('drawing color fields and safe recovery', () => {
  it('reads main/sub colors, and respects OFF even when saved colors remain', () => {
    expect(restore(fixtures[3]).layers[0].effects?.layerColor).toEqual({ main: [200, 32, 64], sub: [32, 220, 160] })
    expect(fixtures[4].layers[0].fields.DrawColorMainRed).toBeDefined()
    expect(restore(fixtures[4]).layers[0].effects).toBeUndefined()
    expect(readMaterialEffects({ LayerUsePaletteColor: 1, LayerPaletteRed: 0xffffffff })).toBeUndefined()
  })

  it('keeps paper fill separate from drawing color and never fills an empty colored raster/vector', async () => {
    const diagnostics: ClipDiagnostic[] = []
    const decode = createMaterialDecoder({ mipmaps: new Map(), mipInfos: new Map(), offscreens: new Map(), thumbnails: [], external: new Map() }, 4, 1, 72, diagnostics)
    const fields = fixtures[1].layers[0].fields, paper = layer('paper')
    await decode(paper, { ...fields, LayerType: 1584 })
    expect(paper.effects).toBeUndefined()
    expect([...paper.pixels!.rgba.slice(0, 4)]).toEqual([62, 140, 236, 255])
    for (const type of [1, 4]) {
      const empty = layer('empty')
      await decode(empty, { ...fields, LayerType: type })
      expect(empty.effects?.layerColor).toBeDefined()
      expect(empty.pixels).toBeUndefined()
    }
  })

  it('retains a valid drawing color when a separate border is malformed', async () => {
    const diagnostics: ClipDiagnostic[] = []
    const decode = createMaterialDecoder({ mipmaps: new Map(), mipInfos: new Map(), offscreens: new Map(), thumbnails: [], external: new Map() }, 4, 1, 72, diagnostics)
    const material = group('folder', [])
    const truncated = new Uint8Array([0, 0, 0, 10, ...Array.from('EffectEdge').flatMap(c => [0, c.charCodeAt(0)]), 0, 0, 0, 1])
    await decode(material, { ...fixtures[1].layers[0].fields, LayerEffectAttached: 1, LayerEffectInfo: truncated })
    expect(material.effects?.layerColor).toEqual({ main: [62, 140, 236], sub: [255, 255, 255] })
    expect(material.effects?.edge).toBeUndefined()
    expect(diagnostics).toHaveLength(1)
  })
})

describe('output and preview scope', () => {
  it.each(['animation', 'cell'])('keeps the %s blend mode when its color and mask are applied', position => {
    const artwork = layer('ink', { pixels: solid([0, 0, 0, 255], 2) })
    const cel = group('1', [artwork]), animation = group('A', [cel], { isAnimationFolder: true })
    Object.assign(position === 'animation' ? animation : cel, {
      effects: green, blendMode: 'multiply', mask: solid([128, 128, 128, 255], 2),
    })
    const tree = treeFor(documentFor([animation, layer('paper', { pixels: solid([128, 128, 128, 255], 4) })]))
    const actual = extractAllEntries(tree, settings, 4, 1)[0].canvas
    expectWithinOne(data(actual), data(flattenToCanvas(tree, 4, 1)))
    if (position === 'animation') expect(pixel(actual, 0)[1]).toBeLessThan(128)
  })

  function scene() {
    const cel = layer('1', { pixels: solid([0, 0, 0, 255], 1, 1) })
    const animation = group('A', [cel, layer('2', { pixels: solid([255, 0, 0, 255], 1, 2) })], { isAnimationFolder: true })
    const other = group('B', [layer('other-cel', { pixels: solid([0, 0, 255, 255], 1, 2) })], { isAnimationFolder: true })
    const parent = group('parent', [animation, other, layer('note', { pixels: solid([255, 255, 255, 255]) })], { effects: green, opacity: 0.25 })
    return treeFor(documentFor([layer('outside', { pixels: solid([255, 255, 0, 255], 1, 3) }), parent,
      layer('paper', { pixels: solid([240, 240, 240, 255], 4) })]))
  }
  it('colors only the selected branch, preserving external paper and excluding other cels/tracks', () => {
    const tree = scene(), entry = extractAllEntries(tree, settings, 4, 1)[0]
    expect([0, 1, 2, 3].map(x => pixel(entry.canvas, x))).toEqual([
      [120, 100, 70, 255], [30, 200, 80, 255], [240, 240, 240, 255], [255, 255, 0, 255],
    ])
    useAppStore.setState({ layerTree: tree, docWidth: 4, docHeight: 1, projectSettings: settings,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, revisionBorderEnabled: false }, timelineData: null,
      focusedAnimFolderId: 'clip:A', selectedLayerId: null, selectedVirtualSetId: null,
      selectedCells: new Map([['clip:A', 0]]), visibilityOverrides: new Map(), manualAnimFolderIds: new Set(), singleMarks: new Map() })
    const { result } = renderHook(() => useOutputPreview())
    expect([...data(result.current[0].canvas)]).toEqual([...data(entry.canvas)])
  })

  it('applies folder colors to marked outputs and virtual insertion, with artwork opacity and masks', () => {
    const target = layer('target', { pixels: solid([0, 0, 0, 255], 2), opacity: 0.5 })
    const doc = documentFor([group('parent', [target], { effects: green, mask: solid([255, 255, 255, 255]), opacity: 0.5 })])
    const tree = treeFor(doc), child = tree[0].children[0]
    child.singleMark = true
    const actual = extractAllEntries(tree, settings, 4, 1, 'transparent')[0].canvas
    const expected = flattenToCanvas(tree, 4, 1, 'transparent')
    expect([...data(actual)]).toEqual([...data(expected)])
    expect(pixel(actual, 0)[3]).toBeCloseTo(64, 0)
    expect(pixel(actual, 1)[3]).toBe(0)
    expect([...data(extractMarkedLayers(tree, 4, 1)[0].canvas)]).toEqual([...data(flattenToCanvas(tree, 4, 1))])
    const vs: VirtualSet = { id: 'vs', name: 'virtual', members: [{ layerId: child.id, blendMode: null, opacity: null }],
      insertionLayerId: child.id, insertionPosition: 'above', visibilityOverrides: {}, expandToAnimationCells: false }
    expect([...data(extractVirtualSetEntries(tree, [vs], 4, 1, 'transparent')[0].canvas)]).toEqual([...data(expected)])
    useAppStore.setState({ layerTree: tree, docWidth: 4, docHeight: 1, projectSettings: settings,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, background: 'transparent' }, timelineData: null,
      focusedAnimFolderId: null, selectedLayerId: child.id, selectedVirtualSetId: null,
      visibilityOverrides: new Map(), manualAnimFolderIds: new Set(), singleMarks: new Map() })
    const { result } = renderHook(() => useOutputPreview())
    expect([...data(result.current[0].canvas)]).toEqual([...data(expected)])
  })

  it('never applies CLIP colors a second time when using native PSD pixels', () => {
    const doc = documentFor([group('parent', [layer('1', { pixels: solid([62, 140, 236, 255]) })], { effects: green })])
    const tree = treeFor(doc, true)
    tree[0].children[0].singleMark = true
    expect(tree[0].materialEffects).toBeUndefined()
    expect(pixel(extractAllEntries(tree, settings, 4, 1, 'transparent')[0].canvas, 0)).toEqual([62, 140, 236, 255])
  })
})
