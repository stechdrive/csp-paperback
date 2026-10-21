import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { Blob as NodeBlob } from 'node:buffer'
import { createCanvas } from '@napi-rs/canvas'
import initSqlJs from 'sql.js'
import { useAppStore } from '../../store'
import { resetTestStore } from '../helpers/store-reset'
import { parseClipDocument } from '../../utils/clip/parser'
import { readPsdFile } from '../../utils/psd-io'
import { buildOutputEntriesFromState } from '../../utils/export-entries'
import { buildC001VirtualSets } from '../../sample/c001-virtual-set'
import type { ClipDocument, ClipLayer } from '../../utils/clip/types'
import type { CspLayer, CellNamingMode } from '../../types'

let clip: ClipDocument
const createElement = document.createElement.bind(document)
const psdBytes = () => new Uint8Array(readFileSync('testdata/c001.psd')).buffer
const all = (nodes: CspLayer[]): CspLayer[] => nodes.flatMap(n => [n, ...all(n.children)])
beforeAll(async () => {
  vi.stubGlobal('Blob', NodeBlob)
  document.createElement = ((tag: string, options?: ElementCreationOptions) => tag === 'canvas' ? createCanvas(1, 1) as unknown as HTMLCanvasElement : createElement(tag, options)) as typeof document.createElement
  const SQL = await initSqlJs({ wasmBinary: new Uint8Array(readFileSync('node_modules/sql.js/dist/sql-wasm.wasm')).buffer })
  clip = await parseClipDocument(readFileSync('public/sample/c001.clip'), SQL, false)
})
afterAll(() => { document.createElement = createElement; vi.unstubAllGlobals() })
beforeEach(() => resetTestStore())

function exportSnapshot() {
  const state = useAppStore.getState()
  useAppStore.setState({ virtualSets: buildC001VirtualSets(state.layerTree) })
  return buildOutputEntriesFromState(useAppStore.getState()).map(e => ({
    name: e.flatName, path: e.path,
    pixels: createHash('sha256').update(e.canvas.getContext('2d')!.getImageData(0, 0, e.canvas.width, e.canvas.height).data).digest('hex'),
  }))
}

describe('CLIP project integration', () => {
  it.each<CellNamingMode>(['cellname', 'sequence', 'sheet-sequence'])('CLIP+PSD output exactly matches PSD+XDTS with %s naming', mode => {
    useAppStore.setState(s => ({ projectSettings: { ...s.projectSettings, cellNamingMode: mode } }))
    useAppStore.getState().loadXdts(readFileSync('testdata/c001.xdts', 'utf8'), 'c001.xdts')
    useAppStore.getState().loadPsd(psdBytes(), 'c001.psd')
    const legacy = exportSnapshot()
    useAppStore.getState().loadClip(clip, 'c001.clip', undefined, { psd: readPsdFile(psdBytes()), name: 'c001.psd' })
    expect(exportSnapshot()).toEqual(legacy)
  }, 30000)

  it('adding PSD preserves native IDs, marks, virtual sets, selections and settings', () => {
    useAppStore.getState().loadClip(clip, 'c001.clip')
    const initial = useAppStore.getState()
    const ids = all(initial.layerTree).map(l => l.id)
    const virtualSets = buildC001VirtualSets(initial.layerTree)
    const singleMarks = new Map([[ids[0], { layerId: ids[0], origin: 'manual' as const }]])
    useAppStore.setState({ virtualSets, singleMarks })
    const anim = all(initial.layerTree).find(layer => layer.isAnimationFolder)!
    useAppStore.getState().setOutputAlias(anim.id, '別名')
    useAppStore.getState().selectLayer(ids[0])
    useAppStore.getState().seekToFrame(3)
    const before = useAppStore.getState()
    useAppStore.getState().loadPsd(psdBytes(), 'c001.psd')
    const after = useAppStore.getState()
    expect(all(after.layerTree).map(l => l.id)).toEqual(ids)
    expect(after.virtualSets).toBe(virtualSets)
    expect(after.singleMarks).toBe(singleMarks)
    expect(after.outputAliases).toBe(before.outputAliases)
    expect(after.outputAliases.get(anim.id)).toBe('別名')
    expect(after.selectedCells).toBe(before.selectedCells)
    expect(after.currentFrame).toBe(3)
    expect(after.selectedLayerId).toBe(ids[0])
    expect(after.projectSettings).toBe(before.projectSettings)
    expect(after.psdFileName).toBe('c001.psd')
    expect(after.xdtsFileName).toBeNull()
  })

  it('mismatched PSD cannot destroy the open project; XDTS cannot overwrite native bindings', () => {
    useAppStore.getState().loadClip(clip, 'c001.clip')
    const before = useAppStore.getState()
    expect(() => before.attachClipPsd({ psd: { width: 10, height: 10 }, name: 'wrong.psd' })).toThrow('一致しません')
    expect(useAppStore.getState()).toBe(before)
    expect(() => before.loadXdts(readFileSync('testdata/c001.xdts', 'utf8'), 'c001.xdts')).toThrow('CLIPのタイムライン')
    expect(useAppStore.getState()).toBe(before)
    before.resetProject()
    expect(useAppStore.getState().clipDocument).toBeNull()
  })

  it('seeks the two A tracks without name-based reassignment', () => {
    useAppStore.getState().loadClip(clip, 'c001.clip', undefined, { psd: readPsdFile(psdBytes()), name: 'c001.psd' })
    const folders = all(useAppStore.getState().layerTree).filter(l => l.isAnimationFolder)
    useAppStore.getState().seekToFrame(0)
    expect(folders.map(l => useAppStore.getState().selectedCells.get(l.id))).toEqual([0, -1, 0])
    useAppStore.getState().seekToFrame(3)
    expect(folders.map(l => useAppStore.getState().selectedCells.get(l.id))).toEqual([-1, 0, -1])
  })

  it('switches native timelines and refreshes unused-cel defaults while retaining manual eyes', () => {
    const cel = (id: string): ClipLayer => ({ id, name: id, isFolder: false, isAnimationFolder: false, expanded: true,
      hidden: false, opacity: 1, blendMode: 'normal', clipping: false, children: [] })
    const document: ClipDocument = { width: 2, height: 2, dpi: 72, diagnostics: [], defaultTimelineId: 1,
      layers: [{ ...cel('A'), isFolder: true, isAnimationFolder: true, children: ['1', '2', '3'].map(cel) },
        { ...cel('unbound'), isFolder: true, isAnimationFolder: true, children: [cel('unbound-cel')] }],
      timelines: [1, 2].map(id => ({ id, bindings: { A: id }, diagnostics: [], data: {
        tracks: [{ name: 'A', trackNo: id, cellNames: [String(id)], frames: [{ frameIndex: 0, cellName: String(id) }] }],
        duration: 12, fps: 24, version: 10, header: { cut: '', scene: '' }, timeTableName: `cut ${id}`,
      } })),
    }
    useAppStore.getState().loadClip(document, 'cuts.clip')
    expect(useAppStore.getState().projectSettings.sharedCutMode).toBe(true)
    expect(useAppStore.getState().visibilityOverrides).toEqual(new Map())
    useAppStore.getState().setSharedCutMode(false)
    expect(useAppStore.getState().visibilityOverrides).toEqual(new Map([['clip:2', true], ['clip:3', true]]))
    expect(useAppStore.getState().selectedCells.get('clip:A')).toBe(0)
    useAppStore.getState().toggleLayerVisibility('clip:3')
    useAppStore.getState().setOutputAlias('clip:A', 'B')
    useAppStore.getState().selectClipTimeline(2)
    expect(useAppStore.getState().outputAliases.get('clip:A')).toBe('B')
    expect(useAppStore.getState().projectSettings.sharedCutMode).toBe(false)
    expect(useAppStore.getState().visibilityOverrides).toEqual(new Map([['clip:1', true], ['clip:3', false]]))
    expect(useAppStore.getState().selectedCells.get('clip:A')).toBe(1)
    expect(useAppStore.getState().layerTree[1].animationFolder?.trackNo).toBeUndefined()
    useAppStore.getState().selectClipTimeline(1)
    expect(useAppStore.getState().visibilityOverrides).toEqual(new Map([['clip:2', true], ['clip:3', false]]))
    useAppStore.getState().resetVisibility()
    expect(useAppStore.getState().visibilityOverrides.get('clip:3')).toBe(true)
    useAppStore.getState().undo()
    useAppStore.getState().selectClipTimeline(2)
    expect(useAppStore.getState().visibilityOverrides.get('clip:3')).toBe(false)
  })

  // The paired case decodes the full PSD twice; allow for slower coverage runs on CI.
  it.each([false, true])('auto-enables shared cuts only on import, preserving manual OFF on timeline/PSD changes (paired=%s)', paired => {
    const secondId = Math.max(...clip.timelines.map(t => t.id)) + 1
    const multiple = { ...clip, timelines: [...clip.timelines, { ...clip.timelines[0], id: secondId }] }
    useAppStore.getState().loadClip(multiple, 'cuts.clip', undefined,
      paired ? { psd: readPsdFile(psdBytes()), name: 'c001.psd' } : undefined)
    expect(useAppStore.getState().projectSettings.sharedCutMode).toBe(true)
    useAppStore.getState().setSharedCutMode(false)
    useAppStore.getState().selectClipTimeline(secondId)
    expect(useAppStore.getState().projectSettings.sharedCutMode).toBe(false)
    useAppStore.getState().loadPsd(psdBytes(), 'c001.psd')
    expect(useAppStore.getState().projectSettings.sharedCutMode).toBe(false)
  }, 30000)

  it.each([false, true])('keeps the shared cut preference for a single timeline (%s)', sharedCutMode => {
    useAppStore.getState().setSharedCutMode(sharedCutMode)
    useAppStore.getState().loadClip({ ...clip, timelines: [clip.timelines[0]], defaultTimelineId: clip.timelines[0].id }, 'single.clip')
    expect(useAppStore.getState().projectSettings.sharedCutMode).toBe(sharedCutMode)
  })

  it('does not auto-enable shared cuts when CLIP+PSD validation fails', () => {
    useAppStore.getState().loadClip(clip, 'c001.clip')
    useAppStore.getState().setSharedCutMode(false)
    const before = useAppStore.getState()
    const multiple = { ...clip, timelines: [...clip.timelines, { ...clip.timelines[0], id: -1 }] }
    expect(() => before.loadClip(multiple, 'invalid.clip', undefined, { psd: { width: 10, height: 10 }, name: 'wrong.psd' })).toThrow('一致しません')
    expect(useAppStore.getState()).toBe(before)
    expect(useAppStore.getState().projectSettings.sharedCutMode).toBe(false)
  })

  it('changes a native glow blend using UI semantics and restores it on undo', () => {
    useAppStore.getState().loadClip(clip, 'c001.clip')
    const tree = useAppStore.getState().layerTree
    tree[0].nativeBlendMode = 12
    tree[0].blendMode = 'linear dodge'
    useAppStore.getState().setLayerBlendMode(tree[0].id, 'linear burn')
    expect(useAppStore.getState().layerTree[0].nativeBlendMode).toBe(4)
    useAppStore.getState().undo()
    expect(useAppStore.getState().layerTree[0].nativeBlendMode).toBe(12)
    useAppStore.getState().redo()
    expect(useAppStore.getState().layerTree[0].nativeBlendMode).toBe(4)
  })
})
