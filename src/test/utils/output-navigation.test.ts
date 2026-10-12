import { afterEach, describe, expect, it } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { useAppStore } from '../../store'
import { selectLayerTreeWithVisibility } from '../../store/selectors'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS, type CspLayer, type VirtualSet } from '../../types'
import { collectOutputNavigation, findOutputNavigationIndex, nextOutputNavigationIndex } from '../../utils/output-navigation'
import { buildOutputEntriesFromState } from '../../utils/export-entries'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

afterEach(() => resetTestStore())

function fixture() {
  const tree = buildLayerTree(makePsd({ children: [
    makeLayer({ name: 'paper' }),
    makeFolder('_BG', [makeLayer()]),
    makeFolder('_container', [makeFolder('_nested', [makeLayer()])]),
    makeFolder('作監 ', [makeAnimationFolder('B', [makeLayer({ name: 'B1' })])]),
    makeAnimationFolder('A', [
      makeLayer({ name: 'hidden-cell', hidden: true }),
      makeLayer({ name: 'leaf-cell' }),
      makeFolder('folder-cell', [
        makeFolder('作監', [makeLayer({ name: 'correction-2' })]),
        makeFolder('_s', [makeLayer({ name: 'correction-1' })]),
        makeLayer({ name: 'body' }),
      ]),
    ]),
    makeLayer({ name: 'notes' }),
  ] }))
  const named = new Map<string, CspLayer>()
  const visit = (layers: CspLayer[]) => layers.forEach(layer => {
    named.set(layer.originalName, layer)
    if (layer.originalName === 'A' || layer.originalName === 'B') {
      layer.isAnimationFolder = true
      layer.animationFolder = { detectedBy: 'manual', trackName: layer.originalName }
    }
    visit(layer.children)
  })
  visit(tree)
  const virtualSet: VirtualSet = {
    id: 'virtual', name: 'layout', insertionLayerId: named.get('_BG')!.id,
    insertionPosition: 'above', members: [{ layerId: named.get('leaf-cell')!.id, blendMode: null, opacity: null }],
    expandToAnimationCells: false, visibilityOverrides: {},
  }
  return { tree, named, virtualSet }
}

describe('final output navigation', () => {
  it('stops once per body, merged process, leaf cell, marked image and placed virtual cell', () => {
    const { tree, named, virtualSet } = fixture()
    const navigation = collectOutputNavigation(tree, DEFAULT_PROJECT_SETTINGS, DEFAULT_OUTPUT_CONFIG, [virtualSet])
    const names = navigation.entries.map(e => e.kind === 'virtualSet' ? e.id : [...named.values()].find(l => l.id === e.id)!.originalName)
    expect(names).toEqual(['folder-cell', '_s', 'leaf-cell', 'B1', '_nested', 'virtual', '_BG'])
    expect(new Set(navigation.entries.map(e => e.id)).size).toBe(navigation.entries.length)
    const process = navigation.entries[1]
    expect(process.memberIds.has(named.get('correction-2')!.id)).toBe(true)
    expect(process.ancestorIds).toContain(named.get('folder-cell')!.id)
  })

  it.each([
    { excludeAutoMarked: false, excludedProcessSuffixes: [] },
    { excludeAutoMarked: true, excludedProcessSuffixes: [] },
    { excludeAutoMarked: false, excludedProcessSuffixes: ['_s'] },
    { excludeAutoMarked: true, excludedProcessSuffixes: ['_s', '_k'] },
  ])('has exactly the same source IDs as export with %j', config => {
    const { tree, named, virtualSet } = fixture()
    resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, ...config },
      singleMarks: new Map([[named.get('_BG')!.id, { layerId: named.get('_BG')!.id, origin: 'manual' }]]),
      virtualSets: [virtualSet, { ...virtualSet, id: 'unplaced', insertionLayerId: null }, { ...virtualSet, id: 'empty', members: [] }],
    })
    const state = useAppStore.getState()
    const navigation = collectOutputNavigation(selectLayerTreeWithVisibility(state), state.projectSettings, state.outputConfig, state.virtualSets)
    expect(navigation.entries.map(e => e.id).sort()).toEqual(buildOutputEntriesFromState(state).map(e => e.sourceLayerId).sort())
  })

  it('respects effective visibility, manual animation and auto-process promotion', () => {
    const tree = buildLayerTree(makePsd({ children: [
      makeFolder('manual', [makeLayer({ name: '1' })]),
      makeFolder('_auto', [makeFolder('_s', [makeLayer()])]),
      makeFolder('hidden-parent', [makeLayer({ name: '_hidden-child' })]),
    ] }))
    resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100,
      manualAnimFolderIds: new Set([tree[2].id]),
      visibilityOverrides: new Map([[tree[0].id, true]]),
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, excludeAutoMarked: true },
    })
    const state = useAppStore.getState()
    const navigation = collectOutputNavigation(selectLayerTreeWithVisibility(state), state.projectSettings, state.outputConfig, [])
    expect(navigation.entries).toHaveLength(2)
    expect(navigation.entries.map(e => e.id).sort()).toEqual(buildOutputEntriesFromState(state).map(e => e.sourceLayerId).sort())
  })

  it('resolves interior layers to their output and skips non-output rows from their tree position', () => {
    const { tree, named } = fixture()
    const nav = collectOutputNavigation(tree, DEFAULT_PROJECT_SETTINGS, DEFAULT_OUTPUT_CONFIG, [])
    expect(findOutputNavigationIndex(nav.entries, named.get('body')!.id, null)).toBe(0)
    expect(findOutputNavigationIndex(nav.entries, named.get('correction-2')!.id, null)).toBe(1)
    expect(nextOutputNavigationIndex(nav, named.get('correction-2')!.id, null, 1)).toBe(2)
    expect(nextOutputNavigationIndex(nav, named.get('notes')!.id, null, 1)).toBe(0)
    expect(nextOutputNavigationIndex(nav, named.get('作監 ')!.id, null, -1)).toBe(2)
    expect(nextOutputNavigationIndex(nav, nav.entries[0].id, null, -1)).toBe(0)
    expect(nextOutputNavigationIndex(nav, nav.entries.at(-1)!.id, null, 1)).toBe(nav.entries.length - 1)
    expect(nextOutputNavigationIndex({ entries: [], rowPositions: new Map() }, null, null, 1)).toBe(-1)
  })
})
