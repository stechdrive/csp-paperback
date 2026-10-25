import { afterEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../store'
import { buildLayerTree } from '../../engine/tree-builder'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'
import { planVirtualSetDrop, resolveVirtualSetLayers, virtualNodeIds, virtualSetTree } from '../../utils/virtual-set-tree'
import { buildMemberFlatsWithOverride } from '../../utils/virtual-set-utils'
import { createOutputRenderKey } from '../../utils/output-render-key'
import { virtualOutputId } from '../../utils/output-identity'
import type { CspLayer } from '../../types'

afterEach(() => resetTestStore())
const state = () => useAppStore.getState()
const current = () => state().virtualSets[0]
const names = (layers: CspLayer[]): unknown[] => layers.map(layer => layer.isFolder
  ? [layer.originalName, names(layer.children)] : layer.originalName)
const virtualNames = () => names(resolveVirtualSetLayers(state().layerTree, current()))

function fixture() {
  const tree = buildLayerTree(makePsd({ children: [
    makeLayer({ name: 'extra', opacity: .42, blendMode: 'multiply' }),
    makeFolder('empty', []), makeFolder('group', [makeLayer({ name: 'lower', opacity: 1 }), makeLayer({ name: 'upper', opacity: 1 })], 'pass through'),
    makeLayer({ name: 'top', opacity: 1 }),
  ] }))
  resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100 })
  state().addVirtualSet('layout')
  const [top, group, empty, extra] = tree
  group.opacity = 100
  state().addVirtualSetMember(current().id, group.id)
  state().addVirtualSetMember(current().id, top.id)
  state().clearHistory()
  const drop = (ids: string[], layerId: string | null, position: 'above' | 'below' | 'inside') =>
    state().insertVirtualSetLayers(current().id, ids, { layerId, position })
  return { tree, top, group, empty, extra, upper: group.children[0], lower: group.children[1], drop }
}

describe('virtual hierarchy editing', () => {
  it('removes a multi-selection and nested folders in one undoable operation without touching source artwork', () => {
    const { tree, top, group, upper } = fixture()
    const before = virtualNames(), sourceNames = names(tree)
    state().setSelectedVsMember(current().id, upper.id)
    state().removeVirtualSetMembers(current().id, [group.id, upper.id, top.id, top.id, 'missing'])
    expect(virtualNames()).toEqual([])
    expect(state().selectedVsMemberId).toBeNull()
    expect(state()._past).toHaveLength(1)
    expect(names(tree)).toEqual(sourceNames)
    state().undo()
    expect(virtualNames()).toEqual(before)
    state().redo()
    expect(virtualNames()).toEqual([])
    const history = state()._past
    state().removeVirtualSetMembers(current().id, [group.id])
    expect(state()._past).toBe(history)
  })

  it('renames source layers and folders only within this virtual cell, including after a move and Undo/Redo', () => {
    const { tree, group, upper, top, drop } = fixture()
    state().addVirtualSet('other')
    const otherId = state().virtualSets[1].id
    state().addVirtualSetMember(otherId, group.id)
    const sourceNames = names(tree), sourceRef = upper.agPsdRef
    state().renameVirtualSetLayer(current().id, group.id, '仕上げ')
    state().renameVirtualSetLayer(current().id, upper.id, '線画')
    expect(virtualNames()).toEqual(['top', ['仕上げ', ['線画', 'lower']]])
    expect(names(resolveVirtualSetLayers(tree, state().virtualSets[1]))).toEqual([['group', ['upper', 'lower']]])
    state().undo()
    expect(virtualNames()).toEqual(['top', ['仕上げ', ['upper', 'lower']]])
    state().redo()
    drop([upper.id], top.id, 'above')
    expect(virtualNames()).toEqual(['線画', 'top', ['仕上げ', ['lower']]])
    expect(resolveVirtualSetLayers(tree, current())[0].agPsdRef).toBe(sourceRef)
    expect(names(tree)).toEqual(sourceNames)
    const history = state()._past
    state().renameVirtualSetLayer(current().id, upper.id, '  ')
    state().renameVirtualSetLayer(current().id, upper.id, '線画')
    state().renameVirtualSetLayer(current().id, 'missing', 'ignored')
    expect(state()._past).toBe(history)
  })

  it('creates local folders with editable composition, and moves their complete subtree without a source folder', () => {
    const { tree, top, extra, drop } = fixture()
    const sourceNames = names(tree)
    const id = state().addVirtualSetFolder(current().id, { layerId: top.id, position: 'above' })!
    state().renameVirtualSetLayer(current().id, id, 'ローカル')
    expect(virtualNames()).toEqual([['ローカル', []], 'top', ['group', ['upper', 'lower']]])
    expect(current().layerOverrides![id]).toEqual({ blendMode: 'pass through', opacity: 100 })
    const nested = state().addVirtualSetFolder(current().id, { layerId: id, position: 'inside' })!
    drop([extra.id], nested, 'inside')
    drop([nested], null, 'inside')
    expect(virtualNames()).toEqual([['ローカル', []], 'top', ['group', ['upper', 'lower']], ['新規フォルダ', ['extra']]])
    state().setVirtualSetLayerBlendMode(current().id, nested, 'normal')
    state().setVirtualSetLayerOpacity(current().id, nested, 50)
    const flats = buildMemberFlatsWithOverride(current().members, resolveVirtualSetLayers(tree, current()),
      100, 100, current().visibilityOverrides, current().layerOverrides)
    expect(flats.find(flat => flat.sourceId === nested)).toMatchObject({ opacity: 50, blendMode: 'normal' })
    expect(flats.find(flat => flat.sourceId === id)).toBeUndefined()
    expect(names(tree)).toEqual(sourceNames)
    const previous = current(), history = state()._past
    drop([nested], extra.id, 'above')
    expect(state().addVirtualSetFolder(current().id, { layerId: top.id, position: 'inside' })).toBeNull()
    expect(state().addVirtualSetFolder(current().id, { layerId: 'missing', position: 'above' })).toBeNull()
    expect(current()).toBe(previous)
    expect(state()._past).toBe(history)
  })

  it('restores a removed local folder, names and child settings with one Undo, and can create the first empty folder', () => {
    const { extra, drop } = fixture()
    state().updateVirtualSet(current().id, { members: [], tree: [] })
    state().clearHistory()
    const id = state().addVirtualSetFolder(current().id, { layerId: null, position: 'inside' })!
    expect(virtualNames()).toEqual([['新規フォルダ', []]])
    state().undo()
    expect(virtualNames()).toEqual([])
    state().redo()
    state().renameVirtualSetLayer(current().id, id, 'セル')
    drop([extra.id], id, 'inside')
    state().renameVirtualSetLayer(current().id, extra.id, '影')
    state().setVirtualSetLayerOpacity(current().id, extra.id, 29)
    state().setVirtualSetVisibilityOverride(current().id, id, false)
    state().clearHistory()
    state().removeVirtualSetMember(current().id, id)
    expect(virtualNames()).toEqual([])
    expect(state().selectedVsMemberId).toBeNull()
    state().undo()
    expect(virtualNames()).toEqual([['セル', ['影']]])
    expect(current().layerOverrides![extra.id]?.opacity).toBe(29)
    expect(current().visibilityOverrides[id]).toBe(false)
    state().redo()
    expect(virtualNames()).toEqual([])
  })

  it('inserts source artwork at exact sibling positions and leaves source hierarchy and artwork untouched', () => {
    const { tree, top, group, extra, empty, drop } = fixture()
    const before = names(tree), sourceRef = extra.agPsdRef
    drop([extra.id], group.id, 'above')
    expect(virtualNames()).toEqual(['top', 'extra', ['group', ['upper', 'lower']]])
    drop([empty.id], top.id, 'above')
    expect(virtualNames()).toEqual([['empty', []], 'top', 'extra', ['group', ['upper', 'lower']]])
    drop([extra.id], group.id, 'below')
    expect(virtualNames()).toEqual([['empty', []], 'top', ['group', ['upper', 'lower']], 'extra'])
    expect(names(tree)).toEqual(before)
    expect(resolveVirtualSetLayers(tree, current()).at(-1)!.agPsdRef).toBe(sourceRef)
    expect(current().layerOverrides![extra.id]).toEqual({ opacity: 42, blendMode: 'multiply' })
  })

  it('inserts into empty folders and between nested children; permits moving a child to the root', () => {
    const { group, empty, extra, upper, lower, top, drop } = fixture()
    drop([empty.id], group.id, 'inside')
    drop([extra.id], empty.id, 'inside')
    expect(virtualNames()).toEqual(['top', ['group', [['empty', ['extra']], 'upper', 'lower']]])
    drop([extra.id], lower.id, 'above')
    expect(virtualNames()).toEqual(['top', ['group', [['empty', []], 'upper', 'extra', 'lower']]])
    drop([upper.id], top.id, 'above')
    expect(virtualNames()).toEqual(['upper', 'top', ['group', [['empty', []], 'extra', 'lower']]])
    expect(resolveVirtualSetLayers(state().layerTree, current())[0].parentId).toBeNull()
  })

  it('moves multi-selection in tree order, carries selected descendants once, and rejects cycles without an Undo entry', () => {
    const { top, group, upper, lower, drop } = fixture()
    drop([lower.id, upper.id], top.id, 'above')
    expect(virtualNames()).toEqual(['upper', 'lower', 'top', ['group', []]])
    drop([upper.id, lower.id], group.id, 'inside')
    drop([upper.id, group.id], top.id, 'above')
    expect(virtualNames()).toEqual([['group', ['upper', 'lower']], 'top'])
    const previous = current(), history = state()._past
    drop([group.id], upper.id, 'below')
    expect(current()).toBe(previous)
    expect(state()._past).toBe(history)
    expect(virtualNodeIds(current().tree!).size).toBe(4)
  })

  it('adopts an already used descendant when its source folder is added, retaining local edits', () => {
    const { group, upper, extra, drop } = fixture()
    state().removeVirtualSetMember(current().id, group.id)
    drop([upper.id], null, 'inside')
    state().setVirtualSetLayerOpacity(current().id, upper.id, 23)
    drop([extra.id], null, 'inside')
    drop([group.id], extra.id, 'above')
    expect(virtualNames()).toEqual(['top', ['group', ['upper', 'lower']], 'extra'])
    expect(current().layerOverrides![upper.id]?.opacity).toBe(23)
    expect([...virtualNodeIds(current().tree!)].filter(id => id === upper.id)).toHaveLength(1)
  })

  it('keeps edits through moves, restores hierarchy on Undo/Redo, and removes a nested member independently', () => {
    const { extra, upper, group, drop } = fixture()
    drop([extra.id], upper.id, 'below')
    state().setVirtualSetLayerOpacity(current().id, extra.id, 31)
    state().setVirtualSetVisibilityOverride(current().id, extra.id, false)
    state().clearHistory()
    drop([extra.id], group.id, 'above')
    const moved = virtualNames()
    expect(current().layerOverrides![extra.id]?.opacity).toBe(31)
    expect(current().visibilityOverrides[extra.id]).toBe(false)
    state().undo()
    expect(virtualNames()).toEqual(['top', ['group', ['upper', 'extra', 'lower']]])
    state().redo()
    expect(virtualNames()).toEqual(moved)
    state().setSelectedVsMember(current().id, upper.id)
    state().removeVirtualSetMember(current().id, upper.id)
    expect(virtualNames()).toEqual(['top', 'extra', ['group', ['lower']]])
    expect(state().selectedVsMemberId).toBeNull()
    state().undo()
    expect(virtualNames()).toEqual(moved)
  })

  it('uses the edited hierarchy in rendering and invalidates the preview key', () => {
    const { extra, upper, group, drop } = fixture()
    const key = () => createOutputRenderKey(state().layerTree, 100, 100, 'transparent', [current()])({ outputId: virtualOutputId(current().id) })
    const beforeKey = key()
    drop([extra.id], upper.id, 'above')
    const flats = buildMemberFlatsWithOverride(current().members, resolveVirtualSetLayers(state().layerTree, current()),
      100, 100, current().visibilityOverrides, current().layerOverrides)
    expect(flats.map(layer => layer.sourceId)).toEqual([group.children[1].id, upper.id, extra.id, state().layerTree[0].id])
    expect(flats.find(layer => layer.sourceId === extra.id)).toMatchObject({ opacity: 42, blendMode: 'multiply' })
    expect(key()).not.toBe(beforeKey)
    const after = key()
    state().undo()
    expect(key()).not.toBe(after)
  })

  it('ignores no-op and invalid targets, including stale or non-folder destinations', () => {
    const { tree, top, group, drop } = fixture()
    const previous = current(), history = state()._past
    drop([top.id], group.id, 'above')
    expect(current()).toBe(previous)
    expect(state()._past).toBe(history)
    drop([top.id], group.id, 'inside')
    state().undo()
    const restored = current()
    expect(planVirtualSetDrop(restored, tree, [group.id], { layerId: top.id, position: 'inside' })).toBeNull()
    expect(planVirtualSetDrop(previous, tree, ['missing'], { layerId: null, position: 'inside' })).toBeNull()
    expect(planVirtualSetDrop(previous, tree, [top.id], { layerId: 'missing', position: 'above' })).toBeNull()
    expect(virtualSetTree(previous, tree)).toHaveLength(2)
    expect(history).toHaveLength(0)
  })
})
