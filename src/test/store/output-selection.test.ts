import { afterEach, describe, expect, it } from 'vitest'
import { combineOutputSelection, outputSelectionPatch } from '../../store/output-selection'
import { useAppStore, type AppStore } from '../../store'
import { selectOutputFiles } from '../../store/selectors'
import { buildLayerTree } from '../../engine/tree-builder'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

afterEach(() => resetTestStore())

describe('shared output selection', () => {
  const selectedOutputIds = new Set(['a', 'e'])
  const state = { selectedOutputIds, outputSelectionAnchor: 'b' } as AppStore
  const orderedIds = ['a', 'b', 'c', 'd', 'e']
  it('replaces for Shift and adds a contiguous range for Ctrl+Shift', () => {
    expect(outputSelectionPatch(state, 'd', '', { range: true, orderedIds }).selectedOutputIds).toEqual(new Set(['b', 'c', 'd']))
    expect(outputSelectionPatch(state, 'd', '', { range: true, toggle: true, orderedIds }).selectedOutputIds).toEqual(new Set(orderedIds))
    expect(selectedOutputIds).toEqual(new Set(['a', 'e']))
  })
  it('adds, removes and toggles a rectangle against its initial snapshot', () => {
    expect(combineOutputSelection(selectedOutputIds, ['a', 'b'], 'add')).toEqual(new Set(['a', 'b', 'e']))
    expect(combineOutputSelection(selectedOutputIds, ['a', 'b'], 'remove')).toEqual(new Set(['e']))
    expect(combineOutputSelection(selectedOutputIds, ['a', 'b'], 'toggle')).toEqual(new Set(['b', 'e']))
    expect(combineOutputSelection(selectedOutputIds, ['a', 'b', 'c'], 'toggle')).toEqual(new Set(['b', 'c', 'e']))
    expect(combineOutputSelection(selectedOutputIds, ['a'], 'toggle')).toEqual(new Set(['e']))
    expect(selectedOutputIds).toEqual(new Set(['a', 'e']))
  })
  it('removing the active item chooses a remaining item, and removing the last clears the output context', () => {
    resetTestStore({ docWidth: 100, docHeight: 100,
      layerTree: buildLayerTree(makePsd({ children: [makeFolder('_A', [makeLayer()]), makeFolder('_B', [makeLayer()])] })) })
    const files = selectOutputFiles(useAppStore.getState()), [a, b] = files.map(file => file.outputId)
    useAppStore.getState().selectOutputFile(a)
    useAppStore.getState().selectOutputFile(b, { toggle: true })
    useAppStore.getState().selectOutputFile(b, { toggle: true })
    expect(useAppStore.getState().activeOutputId).toBe(a)
    expect(useAppStore.getState().selectedOutputIds).toEqual(new Set([a]))
    useAppStore.getState().selectOutputFile(a, { toggle: true })
    expect(useAppStore.getState()).toMatchObject({ activeOutputId: null, activeOutputLabel: '',
      selectedOutputIds: new Set(), outputSelectionAnchor: null, selectedOutputSourceId: null, focusedAnimFolderId: null })
  })
  it('clearing preserves search, view, artwork selection, output gates and edit history', () => {
    resetTestStore({ outputSearch: 'A', outputViewMode: 'single', currentFrame: 12, selectedLayerId: 'material',
      activeOutputId: 'a', activeOutputLabel: 'A', selectedOutputIds: new Set(['a']), outputSelectionAnchor: 'a',
      selectedOutputSourceId: 'source', focusedAnimFolderId: 'folder', outputExclusions: new Set(['gate']) })
    const before = useAppStore.getState()
    before.setOutputSelection(new Set())
    const after = useAppStore.getState()
    expect(after.activeOutputId).toBeNull()
    expect(after.outputSelectionAnchor).toBeNull()
    expect(after).toMatchObject({ outputSearch: 'A', outputViewMode: 'single', currentFrame: 12, selectedLayerId: 'material' })
    expect(after.outputExclusions).toBe(before.outputExclusions)
    expect(after._past).toBe(before._past)
    expect(after._future).toBe(before._future)
  })
})
