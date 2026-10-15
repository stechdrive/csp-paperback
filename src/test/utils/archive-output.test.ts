import { afterEach, describe, expect, it } from 'vitest'
import { buildClipLayerTree, clipRenderingSource } from '../../engine/clip-tree'
import { buildLayerTree } from '../../engine/tree-builder'
import { useAppStore } from '../../store'
import { selectLayerTreeWithVisibility, selectOutputCandidates, selectOutputFiles, selectOutputNavigation } from '../../store/selectors'
import { DEFAULT_PROJECT_SETTINGS, type CspLayer } from '../../types'
import type { ClipDocument, ClipLayer } from '../../utils/clip/types'
import { buildDefaultVisibilityOverrides } from '../../utils/default-visibility'
import { buildOutputEntriesFromState } from '../../utils/export-entries'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

afterEach(resetTestStore)

function layer(id: string, name: string, children?: ClipLayer[]): ClipLayer {
  return { id, name, isFolder: children !== undefined, children: children ?? [],
    isAnimationFolder: false, expanded: true, hidden: false, opacity: 1, blendMode: 'normal', clipping: false,
    pixels: children ? undefined : { width: 1, height: 1, left: 0, top: 0, rgba: new Uint8ClampedArray([0, 0, 0, 255]) } }
}

function fixture() {
  const animation = { ...layer('animation', 'A', [layer('cell', '1', [
    layer('body', '線'), layer('correction', '_s', [layer('correction-ink', '修正')]),
  ])]), isAnimationFolder: true, hidden: true }
  const clip: ClipDocument = { width: 16, height: 16, dpi: 72, diagnostics: [], timelines: [], defaultTimelineId: null,
    layers: [layer('pool', '_pool', [
      layer('director', '_k', [layer('director-ink', '線')]),
      layer('chief', '_ss', [layer('chief-ink', '線')]),
      layer('nested', '予備', [layer('instructions', '撮影指示', [layer('instruction-ink', '線')]),
        layer('bg', '_BG', [layer('bg-process', '_e', [layer('bg-ink', '線')])])]),
      layer('manual', '手動用', [layer('manual-cell', '1', [layer('manual-ink', '線')])]),
      layer('process', '監督', [animation]),
    ]), layer('outside', '_SL', [layer('outside-ink', '線')])] }
  const tree = buildClipLayerTree(clip, clipRenderingSource(clip), undefined, DEFAULT_PROJECT_SETTINGS, false)
  resetTestStore({ layerTree: tree, docWidth: 16, docHeight: 16 })
  const nodes = new Map<string, CspLayer>()
  function walk(layers: CspLayer[]) { for (const node of layers) { nodes.set(node.id, node); walk(node.children) } }
  walk(tree)
  const get = (id: string) => nodes.get(`clip:${id}`)!
  return { tree, nodes, get }
}

describe('archive branch output exclusion', () => {
  it('ignores nested name matches and CLIP animation outputs even when the archive is visible', () => {
    const { tree, nodes, get } = fixture()
    get('animation').hidden = false
    const archived = [...nodes.values()].filter(node => node.id !== get('outside').id && node.id !== get('outside-ink').id)
    expect(archived.every(node => !node.autoMarked && node.individualOutputExcludedBy === '_pool')).toBe(true)
    expect(selectLayerTreeWithVisibility(useAppStore.getState())).toBe(tree)
    expect(get('bg').isAnimationFolder).toBe(false)
    const state = useAppStore.getState()
    expect(selectOutputCandidates(state).map(entry => entry.id)).toEqual([get('outside').id])
    expect(selectOutputNavigation(state).entries.map(entry => entry.id)).toEqual([get('outside').id])
    expect(selectOutputFiles(state).map(entry => entry.sourceLayerId)).toEqual([get('outside').id])
    expect(buildOutputEntriesFromState(state).map(entry => entry.sourceLayerId)).toEqual([get('outside').id])
  })

  it('keeps archived eyes untouched by individual display and shared-cut defaults', () => {
    const { tree, get } = fixture()
    get('director').hidden = true
    get('outside').hidden = true
    const timeline = { version: 10, header: { cut: '', scene: '' }, timeTableName: 'test', duration: 1, fps: 24, tracks: [] }
    const overrides = buildDefaultVisibilityOverrides(tree, timeline, true)
    expect(overrides.has(get('director').id)).toBe(false)
    expect(overrides.has(get('animation').id)).toBe(false)
    expect(overrides.get(get('outside').id)).toBe(false)
  })

  it('allows an explicit individual mark and restores exclusion on Undo', () => {
    const { get } = fixture()
    useAppStore.getState().toggleSingleMark(get('director').id)
    expect(selectOutputCandidates(useAppStore.getState()).find(entry => entry.id === get('director').id)?.outputTarget?.processSuffixes).toEqual(['_k'])
    expect(selectOutputFiles(useAppStore.getState()).map(entry => entry.sourceLayerId)).toContain(get('director').id)
    useAppStore.getState().undo()
    expect(selectOutputCandidates(useAppStore.getState()).map(entry => entry.id)).toEqual([get('outside').id])
  })

  it('allows explicit animation output and virtual cells using archived material', () => {
    const { get } = fixture()
    useAppStore.getState().toggleManualAnimFolder(get('manual').id)
    useAppStore.setState({ virtualSets: [{ id: 'virtual', name: '確認',
      insertionLayerId: get('outside').id, insertionPosition: 'above', expandToAnimationCells: false,
      members: [{ layerId: get('director-ink').id, blendMode: null, opacity: null }],
      visibilityOverrides: { [get('director-ink').id]: true },
    }] })
    const state = useAppStore.getState()
    const ids = [get('outside').id, get('manual-cell').id, 'virtual'].sort()
    expect(selectOutputCandidates(state).map(entry => entry.id).sort()).toEqual(ids)
    expect(selectOutputFiles(state).map(entry => entry.sourceLayerId).sort()).toEqual(ids)
    expect(buildOutputEntriesFromState(state).map(entry => entry.sourceLayerId).sort()).toEqual(ids)
  })

  it('propagates custom prefixes through ordinary folders without affecting siblings', () => {
    const tree = buildLayerTree(makePsd({ children: [
      makeFolder('保管_01', [makeFolder('資料', [makeFolder('_k', [makeLayer()])])]),
      makeFolder('_k', [makeLayer()]),
    ] }), undefined, ['保管'])
    resetTestStore({ layerTree: tree })
    const stored = tree.find(node => node.originalName === '保管_01')!.children[0].children[0]
    const active = tree.find(node => node.originalName === '_k')!
    expect(stored.individualOutputExcludedBy).toBe('保管')
    expect(selectOutputCandidates(useAppStore.getState()).map(entry => entry.id)).toEqual([active.id])
  })

  it('does not split excluded cel or process folders into automatic outputs', () => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('A', [
      makeFolder('_old_1', [makeLayer()]),
      makeFolder('1', [makeLayer({ name: 'body' }), makeFolder('_s', [makeLayer()])]),
    ])] }), undefined, ['_old', '_s'])
    tree[0].isAnimationFolder = true
    tree[0].animationFolder = { detectedBy: 'clip', trackName: 'A' }
    resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100 })
    const cell = tree[0].children.find(node => node.originalName === '1')!
    const state = useAppStore.getState()
    expect(selectOutputCandidates(state).map(entry => entry.id)).toEqual([cell.id])
    expect(selectOutputFiles(state).map(entry => entry.sourceLayerId)).toEqual([cell.id])
  })
})
