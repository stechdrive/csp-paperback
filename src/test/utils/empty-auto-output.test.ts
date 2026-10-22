import { afterEach, describe, expect, it } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { useAppStore } from '../../store'
import { selectOutputFiles, selectOutputNavigation, selectOutputAliasTargets, selectMarkedLayerIds } from '../../store/selectors'
import { isAutoMarkedContainerOutputSuppressed } from '../../utils/auto-marked-container'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

afterEach(resetTestStore)
describe('structurally empty automatic individual outputs', () => {
  it('omits arbitrary empty and folder-only outputs from every output surface while retaining the source tree', () => {
    const tree = buildLayerTree(makePsd({ children: [
      makeFolder('_unused', []), makeFolder('_nested', [makeFolder('subfolder', [])]),
      makeFolder('_used', [makeLayer()]),
    ] }))
    resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100 })
    const state = useAppStore.getState(), used = tree.find(layer => layer.originalName === '_used')!
    expect(selectOutputFiles(state).map(file => file.sourceLayerId)).toEqual([used.id])
    expect(selectOutputNavigation(state).entries.map(entry => entry.id)).toEqual([used.id])
    expect([...selectOutputAliasTargets(state).keys()]).toEqual([used.id])
    expect([...selectMarkedLayerIds(state)]).toEqual([used.id])
    expect(state.layerTree).toBe(tree)
    expect(tree).toHaveLength(3)
    expect(tree.every(layer => layer.autoMarked)).toBe(true)
  })

  it('also suppresses empty folders matched by the configured names, without depending on an underscore', () => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('Custom asset', [])] }), undefined, [], ['Custom asset'])
    expect(isAutoMarkedContainerOutputSuppressed(tree[0])).toBe(true)
  })

  it.each(['transparent', 'hidden', 'zero opacity', 'deferred or unavailable'] as const)('retains an existing %s artwork layer', state => {
    const child = makeLayer({ hidden: state === 'hidden', opacity: state === 'zero opacity' ? 0 : 255 })
    if (state === 'deferred or unavailable') delete child.canvas
    const tree = buildLayerTree(makePsd({ children: [makeFolder('_asset', [child])] }))
    expect(isAutoMarkedContainerOutputSuppressed(tree[0])).toBe(false)
    resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100 })
    expect(selectOutputFiles(useAppStore.getState()).map(file => file.sourceLayerId)).toEqual([tree[0].id])
  })

  it('allows an explicit individual mark on an empty folder and restores suppression on undo', () => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('_asset', [])] }))
    resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100 })
    useAppStore.getState().toggleSingleMark(tree[0].id)
    expect(selectOutputFiles(useAppStore.getState()).map(file => file.sourceLayerId)).toEqual([tree[0].id])
    useAppStore.getState().undo()
    expect(selectOutputFiles(useAppStore.getState())).toHaveLength(0)
  })

  it('preserves empty cels and applies process promotion before individual-output suppression', () => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('_asset', [makeFolder('_e', [])])] }))
    resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100 })
    const files = selectOutputFiles(useAppStore.getState())
    expect(files).toHaveLength(1)
    expect(files[0].animFolderId).toBe(tree[0].id)
    expect(files[0].sourceLayerId).toBe(tree[0].children[0].id)
  })
})
