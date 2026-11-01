// @vitest-environment node
import { beforeAll, afterAll, expect, it, vi } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { readFileSync } from 'node:fs'
import type { Layer, Psd } from 'ag-psd'
import type { RenderNode } from 'celcodec/render'
import { buildLayerTree } from '../../engine/tree-builder'
import { bindClipSource } from '../../engine/clip-source'
import { createClipOutput, createClipPreview } from '../../engine/clip-composition'
import { planAllEntries, planVirtualSetEntries } from '../../engine/cell-extractor'
import { DEFAULT_PROJECT_SETTINGS, DEFAULT_OUTPUT_CONFIG, type CspLayer, type VirtualSet } from '../../types'
import { buildOutputPlan } from '../../utils/output-plan'
import { renderOutputFileAsync } from '../../utils/output-render-queue'
import { renderOutputRegion } from '../../utils/output-region-render'
import { renderClipPng } from '../../utils/clip-png-export'
import { openClipSession, type ClipSession } from '../../utils/clip/parser'
import type { ClipReader } from '../../utils/clip-io'
import type { ClipLayer } from '../../utils/clip/types'
import { sessionFixture, sessionIds } from '../fixtures/clip-session'

let SQL: SqlJsStatic
beforeAll(async () => {
  SQL = await initSqlJs({ wasmBinary: new Uint8Array(readFileSync('node_modules/sql.js/dist/sql-wasm.wasm')).buffer })
  vi.stubGlobal('document', { createElement: () => createCanvas(1, 1) })
})
afterAll(() => vi.unstubAllGlobals())
const settings = { ...DEFAULT_PROJECT_SETTINGS, processTable: [{ folderNames: ['EN'], suffix: '_e' }], autoMarkFolderNames: [], archivePatterns: [] }
const flat = (nodes: readonly RenderNode[]): RenderNode[] => nodes.flatMap(n => [n, ...flat(n.children ?? [])])
function fakeTree(roots: Layer[], bind = true) {
  const tree = buildLayerTree({ width: 64, height: 64, children: roots.slice().reverse() }, undefined, [], [])
  const reader: ClipReader = { decode: vi.fn(), render: vi.fn(), dispose: vi.fn() }
  const walk = (layers: CspLayer[]) => layers.forEach(l => { if (bind) bindClipSource(l.agPsdRef, l.originalName, reader); walk(l.children) })
  walk(tree); return { tree, reader }
}
const leaf = (name: string, extra: Partial<Layer> = {}): Layer => ({ name, opacity: 0.5, blendMode: 'normal', canvas: createCanvas(1, 1) as unknown as HTMLCanvasElement, ...extra })
const group = (name: string, children: Layer[], extra: Partial<Layer> = {}): Layer => ({ ...leaf(name, extra), children: children.slice().reverse(), sectionDivider: { type: 1 } })
const renderedPixel = (c: HTMLCanvasElement, x: number, y: number) => [...c.getContext('2d')!.getImageData(x, y, 1, 1).data]

it('keeps structural hierarchy, hidden clipping bases and explicit process selection while retaining artwork opacity', () => {
  const { tree } = fakeTree([group('parent', [group('A', [group('1', [leaf('clip', { clipping: true }), leaf('hidden base', { hidden: true }), group('EN', [leaf('correction')])])])])])
  const a = tree[0].children[0]; a.isAnimationFolder = true
  const plans = planAllEntries(tree, settings, 64, 64, 'transparent')
  expect(plans).toHaveLength(2)
  for (const plan of plans) {
    const d = createClipOutput(tree, plan, 64, 64, 'transparent')!
    const nodes = new Map(flat(d.composition.layers).map(n => [n.layerId, n]))
    expect(nodes.get('parent')?.opacity).toBe(1)
    expect(nodes.get('A')?.opacity).toBe(1)
    expect(nodes.get('1')?.opacity).toBe(1)
    if (nodes.has('EN')) { expect(nodes.get('EN')?.opacity).toBe(1); expect(nodes.get('correction')?.opacity).toBe(0.5); expect(nodes.has('clip')).toBe(false) }
    else { expect(nodes.get('clip')?.clipping).toBe(true); expect(nodes.get('hidden base')?.visible).toBe(false); expect(nodes.get('clip')?.opacity).toBe(0.5) }
    expect(tree[0].opacity).toBe(50)
  }
})

it('preserves native glow blend identity and zero opacity, and keeps PSD routes outside the native renderer', () => {
  const { tree } = fakeTree([leaf('glow')]); tree[0].nativeBlendMode = 10; tree[0].opacity = 0
  const p = createClipPreview(tree, 64, 64)!
  expect(p.composition.layers[0]).toMatchObject({ blendMode: 10, opacity: 0 })
  tree[0].nativeBlendMode = 999
  expect(createClipPreview(tree, 64, 64)!.composition.layers[0].blendMode).toBe(0)
  expect(createClipPreview(fakeTree([leaf('psd')], false).tree, 64, 64)).toBeUndefined()
  expect(createClipOutput(tree, { outputId: '', gateId: '', sourceLayerId: '', path: '', flatName: '', renderCanvas: vi.fn() }, 64, 64, 'white')).toBeUndefined()
})

it('renders virtual folders, reorders native children and isolates overrides without duplicating instance identities', () => {
  const { tree } = fakeTree([group('parent', [leaf('target'), group('source', [leaf('a'), leaf('b')])])])
  const [target, source] = tree[0].children
  const vs: VirtualSet = { id: 'vs', name: 'v', insertionLayerId: target.id, insertionPosition: 'above', expandToAnimationCells: false,
    members: [{ layerId: source.id, blendMode: 'multiply', opacity: 25 }], visibilityOverrides: { [source.children[1].id]: false },
    layerOverrides: { [source.id]: { opacity: 0 } }, tree: [{ layerId: 'new-group', virtualFolder: true, children: [
      { layerId: source.id, children: [{ layerId: source.children[1].id, children: [] }, { layerId: source.children[0].id, children: [] }] } ] }] }
  for (const position of ['above', 'below'] as const) {
    vs.insertionPosition = position
    const plan = planVirtualSetEntries(tree, [vs], 64, 64)[0]
    const d = createClipOutput(tree, plan, 64, 64, 'white')!, nodes = flat(d.composition.layers)
    const virtual = d.composition.layers[0].children!.find(n => n.id === 'virtual:group')!
    expect(virtual.blendMode).toBe(0)
    const selected = virtual.children![0].children![0]
    expect(selected).toMatchObject({ layerId: 'source', opacity: 0, blendMode: 2 })
    expect(selected.children?.map(n => n.layerId)).toEqual(['b', 'a'])
    expect(selected.children?.[0].visible).toBe(false)
    expect(new Set(nodes.map(n => n.id)).size).toBe(nodes.length)
    expect(d.composition.background).toEqual([255, 255, 255, 255])
  }
  expect(source.opacity).toBe(50)
})

it('selects preview cels independently of exposure and honors virtual visibility before selection', () => {
  const { tree } = fakeTree([group('A', [leaf('hidden', { hidden: true }), leaf('visible')])]); tree[0].isAnimationFolder = true
  const a = tree[0], hidden = a.children[0]
  expect(createClipPreview(tree, 64, 64)!.composition.layers[0].children![0].layerId).toBe('visible')
  expect(createClipPreview(tree, 64, 64, { selectedCells: new Map([[a.id, -1]]) })!.composition.layers[0].children).toEqual([])
  expect(createClipPreview(tree, 64, 64, { visibility: { [hidden.id]: true } })!.composition.layers[0].children![0].layerId).toBe('hidden')
})

function sessionTree(session: ClipSession): CspLayer[] {
  const convert = (l: ClipLayer): Layer => { const ref: Layer = { name: l.name, opacity: l.opacity, hidden: l.hidden, blendMode: l.blendMode,
    clipping: l.clipping, ...(l.isFolder ? { children: l.children.slice().reverse().map(convert), sectionDivider: { type: 1 } } : {}) }
    bindClipSource(ref, l.id, session); return ref }
  const psd: Psd = { width: session.document.width, height: session.document.height, children: session.document.layers.slice().reverse().map(convert) }
  const tree = buildLayerTree(psd, undefined, [], [])
  const a = tree.find(l => l.originalName === 'A')!; a.isAnimationFolder = true
  return tree
}

it('runs normal output, native regions and streamed PNG through the installed public compositor', async () => {
  const session = await openClipSession(await sessionFixture(SQL), SQL, { canvas: createCanvas })
  try {
    const tree = sessionTree(session), config = { ...DEFAULT_OUTPUT_CONFIG, background: 'transparent' as const }
    const files = buildOutputPlan(tree, { projectSettings: settings, virtualSets: [], docWidth: 64, docHeight: 64, timelineData: null, outputConfig: config })
    const file = files[0]; expect(file.clipDrawing).toBeDefined()
    const original = await renderOutputFileAsync(file, settings.processTable, false)
    expect(renderedPixel(original.canvas, 3, 5)).toEqual([255, 0, 0, 255])
    const region = await renderOutputRegion(file, { left: 2, top: 4, width: 4, height: 4 }, 1, [], false)
    expect(renderedPixel(region.canvas, 1, 1)).toEqual([255, 0, 0, 255])
    const blob = await renderClipPng(file, [], false, [], 144, 144, vi.fn())
    const decoded = await loadImage(Buffer.from(await blob.arrayBuffer())), canvas = createCanvas(64, 64)
    canvas.getContext('2d').drawImage(decoded, 0, 0)
    expect([...canvas.getContext('2d').getImageData(3, 5, 1, 1).data]).toEqual([255, 0, 0, 255])
    expect(original.sources.content.size).toBe(2)
    vi.spyOn(file.clipDrawing!, 'render').mockResolvedValueOnce({ status: 'unavailable', pixels: undefined, nodes: [],
      diagnostics: [{ code: 'MISSING_MATERIAL', kind: 'missing', severity: 'error' }] })
    await expect(renderClipPng(file, [], false, [], 72, 72, vi.fn())).rejects.toThrow('素材画像')
    await expect(renderOutputRegion(file, { left: 0, top: 0, width: 1, height: 1 }, 1, [], false, [], () => true)).rejects.toThrow('中止')
  } finally { session.dispose() }
})

it('reads far-away regions of a 50,000px square and releases its renderer', async () => {
  const session = await openClipSession(await sessionFixture(SQL, [{ type: 'resizeCanvas', width: 50000, height: 50000, anchor: 'top-left' }]), SQL, { canvas: createCanvas })
  try {
    const result = await session.render({ layers: [{ id: 'cel', layerId: sessionIds.cel }], background: [255, 255, 255, 255] }, { left: 49999, top: 49999, width: 1, height: 1 })
    expect([...result.pixels!.rgba]).toEqual([255, 255, 255, 255])
    session.dispose()
    await expect(session.render({ layers: [] }, { left: 0, top: 0, width: 1, height: 1 })).rejects.toThrow()
  } finally { session.dispose() }
})
