import type { StateCreator } from 'zustand'
import type { SingleMark, VirtualSet } from '../types'
import type { CspLayer } from '../types'
import type { VirtualSetDropTarget, VirtualSetLayerOverride } from '../types/marks'
import type { AppStore } from './index'
import type { HistoryOptions } from './history-slice'
import { isMediaLayer } from '../utils/layer-display'
import { findVirtualNode, planVirtualFolderCreation, planVirtualSetDrop, removeVirtualNodes, renameVirtualNode, resolveVirtualSetLayers, virtualNodeIds, virtualSetTree, withVirtualSetTree } from '../utils/virtual-set-tree'

export interface MarksSlice {
  singleMarks: Map<string, SingleMark>
  virtualSets: VirtualSet[]
  toggleSingleMark: (layerId: string) => void
  addVirtualSet: (name: string) => void
  updateVirtualSet: (id: string, updates: Partial<Omit<VirtualSet, 'id'>>, options?: HistoryOptions) => void
  removeVirtualSet: (id: string) => void
  addVirtualSetMember: (setId: string, layerId: string) => void
  insertVirtualSetLayers: (setId: string, layerIds: string[], target: VirtualSetDropTarget) => void
  addVirtualSetFolder: (setId: string, target: VirtualSetDropTarget) => string | null
  renameVirtualSetLayer: (setId: string, layerId: string, name: string) => void
  removeVirtualSetMember: (setId: string, layerId: string) => void
  removeVirtualSetMembers: (setId: string, layerIds: string[]) => void
  reorderVirtualSetMembers: (setId: string, newOrder: string[]) => void
  setVirtualSetMemberBlendMode: (setId: string, layerId: string, blendMode: string | null, options?: HistoryOptions) => void
  setVirtualSetMemberOpacity: (setId: string, layerId: string, opacity: number | null, options?: HistoryOptions) => void
  setVirtualSetLayerBlendMode: (setId: string, layerId: string, blendMode: string | null, options?: HistoryOptions) => void
  setVirtualSetLayerOpacity: (setId: string, layerId: string, opacity: number | null, options?: HistoryOptions) => void
  setVirtualSetVisibilityOverride: (setId: string, layerId: string, visible: boolean, options?: HistoryOptions) => void
}

function findLayerInTree(layers: CspLayer[], id: string): CspLayer | null {
  for (const l of layers) {
    if (l.id === id) return l
    const found = findLayerInTree(l.children, id)
    if (found) return found
  }
  return null
}

/** レイヤー（フォルダを含む）のサブツリー全体の現在の表示状態をオーバーライドマップに書き込む */
function captureVisibilitySnapshot(
  layer: CspLayer,
  globalOverrides: Map<string, boolean>,
  out: Record<string, boolean>,
): void {
  out[layer.id] = globalOverrides.has(layer.id)
    ? !globalOverrides.get(layer.id)!
    : !layer.hidden && !layer.uiHidden
  for (const child of layer.children) {
    captureVisibilitySnapshot(child, globalOverrides, out)
  }
}

/** レイヤー（フォルダを含む）のサブツリー全体の現在の合成設定を仮想セル内初期値として固定する */
function captureCompositeSnapshot(
  layer: CspLayer,
  out: Record<string, VirtualSetLayerOverride>,
): void {
  out[layer.id] = {
    blendMode: layer.blendMode,
    opacity: layer.opacity,
  }
  for (const child of layer.children) {
    captureCompositeSnapshot(child, out)
  }
}

function setLayerBlendModeOverride(vs: VirtualSet, layerId: string, blendMode: string | null): VirtualSet {
  const layerOverrides = { ...(vs.layerOverrides ?? {}) }
  const current = { ...(layerOverrides[layerId] ?? {}) }
  if (blendMode === null) {
    delete current.blendMode
  } else {
    current.blendMode = blendMode
  }

  if (current.blendMode === undefined && current.opacity === undefined) {
    delete layerOverrides[layerId]
  } else {
    layerOverrides[layerId] = current
  }

  return {
    ...vs,
    members: vs.members.map(m =>
      m.layerId === layerId ? { ...m, blendMode } : m
    ),
    layerOverrides,
  }
}

function setLayerOpacityOverride(vs: VirtualSet, layerId: string, opacity: number | null): VirtualSet {
  const layerOverrides = { ...(vs.layerOverrides ?? {}) }
  const current = { ...(layerOverrides[layerId] ?? {}) }
  if (opacity === null) {
    delete current.opacity
  } else {
    current.opacity = Math.max(0, Math.min(100, opacity))
  }

  if (current.blendMode === undefined && current.opacity === undefined) {
    delete layerOverrides[layerId]
  } else {
    layerOverrides[layerId] = current
  }

  return {
    ...vs,
    members: vs.members.map(m =>
      m.layerId === layerId ? { ...m, opacity } : m
    ),
    layerOverrides,
  }
}

export const createMarksSlice: StateCreator<AppStore, [], [], MarksSlice> = (set, get) => ({
  singleMarks: new Map(),
  virtualSets: [],

  toggleSingleMark: (layerId) => {
    if (isMediaLayer(findLayerInTree(get().layerTree, layerId))) return
    get().pushHistory()
    const current = new Map(get().singleMarks)
    if (current.has(layerId)) {
      current.delete(layerId)
    } else {
      current.set(layerId, { layerId, origin: 'manual' })
    }
    set({ singleMarks: current })
  },

  addVirtualSet: (name) => {
    get().pushHistory()
    const newSet: VirtualSet = {
      id: crypto.randomUUID(),
      name,
      insertionLayerId: null,
      insertionPosition: 'above',
      members: [],
      layerOverrides: {},
      expandToAnimationCells: false,
      visibilityOverrides: {},
    }
    set({
      virtualSets: [...get().virtualSets, newSet],
      selectedVirtualSetId: newSet.id,
    })
  },

  updateVirtualSet: (id, updates, options) => {
    if (options?.recordHistory !== false) get().pushHistory()
    set({
      virtualSets: get().virtualSets.map(vs =>
        vs.id === id ? { ...vs, ...updates } : vs
      ),
    })
  },

  removeVirtualSet: (id) => {
    const state = get()
    if (!state.virtualSets.some(vs => vs.id === id)) return
    get().pushHistory()
    set({
      virtualSets: state.virtualSets.filter(vs => vs.id !== id),
      ...(state.selectedVirtualSetId === id ? {
        selectedVirtualSetId: null,
      } : {}),
      ...(state.selectedVsMemberSetId === id ? { selectedVsMemberSetId: null, selectedVsMemberId: null } : {}),
    })
  },

  addVirtualSetMember: (setId, layerId) => {
    const state = get()
    if (isMediaLayer(findLayerInTree(state.layerTree, layerId))) return
    const vs = state.virtualSets.find(v => v.id === setId)
    if (!vs) return
    if (vs.members.some(m => m.layerId === layerId)) return

    if (vs.tree) {
      get().insertVirtualSetLayers(setId, [layerId], vs.tree[0]
        ? { layerId: vs.tree[0].layerId, position: 'above' }
        : { layerId: null, position: 'inside' })
      return
    }

    get().pushHistory()
    // 追加するレイヤー（フォルダも含む）のサブツリーについて、
    // 現在のグローバル表示状態を初期オーバーライドとして取得する
    const layer = findLayerInTree(state.layerTree, layerId)
    const newOverrides = { ...vs.visibilityOverrides }
    const newLayerOverrides = { ...(vs.layerOverrides ?? {}) }
    if (layer) {
      captureVisibilitySnapshot(layer, state.visibilityOverrides, newOverrides)
      captureCompositeSnapshot(layer, newLayerOverrides)
    }

    set({
      virtualSets: state.virtualSets.map(v => {
        if (v.id !== setId) return v
        return {
          ...v,
          members: [{ layerId, blendMode: null, opacity: null }, ...v.members],  // 先頭に追加（上レイヤー扱い）
          visibilityOverrides: newOverrides,
          layerOverrides: newLayerOverrides,
        }
      }),
    })
  },

  insertVirtualSetLayers: (setId, layerIds, target) => {
    const state = get(), vs = state.virtualSets.find(item => item.id === setId)
    if (!vs) return
    const tree = planVirtualSetDrop(vs, state.layerTree, layerIds, target)
    if (!tree) return
    const oldIds = virtualNodeIds(virtualSetTree(vs, state.layerTree))
    const next = withVirtualSetTree(vs, tree)
    next.visibilityOverrides = { ...vs.visibilityOverrides }
    for (const id of virtualNodeIds(tree)) {
      if (oldIds.has(id)) continue
      const layer = findLayerInTree(state.layerTree, id)
      if (!layer) continue
      next.visibilityOverrides[id] = state.visibilityOverrides.has(id)
        ? !state.visibilityOverrides.get(id)! : !layer.hidden && !layer.uiHidden
      next.layerOverrides![id] = { blendMode: layer.blendMode, opacity: layer.opacity }
    }
    state.pushHistory()
    set({ virtualSets: state.virtualSets.map(item => item.id === setId ? next : item),
      selectedVirtualSetId: setId, selectedVsMemberSetId: setId, selectedVsMemberId: layerIds[0] ?? null })
  },

  addVirtualSetFolder: (setId, target) => {
    const state = get(), vs = state.virtualSets.find(item => item.id === setId)
    if (!vs) return null
    const folderId = `virtual-folder-${crypto.randomUUID()}`
    const tree = planVirtualFolderCreation(vs, state.layerTree, folderId, target)
    if (!tree) return null
    const next = withVirtualSetTree(vs, tree)
    next.visibilityOverrides = { ...vs.visibilityOverrides, [folderId]: true }
    next.layerOverrides![folderId] = { blendMode: 'pass through', opacity: 100 }
    state.pushHistory()
    set({ virtualSets: state.virtualSets.map(item => item.id === setId ? next : item),
      selectedVirtualSetId: setId, selectedVsMemberSetId: setId, selectedVsMemberId: folderId })
    return folderId
  },

  renameVirtualSetLayer: (setId, layerId, name) => {
    const state = get(), vs = state.virtualSets.find(item => item.id === setId)
    if (!vs) return
    const tree = virtualSetTree(vs, state.layerTree), node = findVirtualNode(tree, layerId)
    const nextName = name.trim()
    const currentName = node?.name ?? findLayerInTree(state.layerTree, layerId)?.originalName
    if (!node || !nextName || nextName === currentName) return
    const next = withVirtualSetTree(vs, renameVirtualNode(tree, layerId, nextName))
    state.pushHistory()
    set({ virtualSets: state.virtualSets.map(item => item.id === setId ? next : item) })
  },

  removeVirtualSetMember: (setId, layerId) => get().removeVirtualSetMembers(setId, [layerId]),

  removeVirtualSetMembers: (setId, layerIds) => {
    const state = get()
    const vs = state.virtualSets.find(v => v.id === setId)
    if (!vs) return
    const tree = virtualSetTree(vs, state.layerTree), existing = virtualNodeIds(tree)
    const ids = new Set(layerIds.filter(id => existing.has(id)))
    if (!ids.size) return
    get().pushHistory()
    const nextSet = withVirtualSetTree(vs, removeVirtualNodes(tree, ids))
    const selectedMemberExists = state.selectedVsMemberId !== null && !!findLayerInTree(
      resolveVirtualSetLayers(state.layerTree, nextSet),
      state.selectedVsMemberId,
    )
    set({
      virtualSets: state.virtualSets.map(vs => vs.id === setId ? nextSet : vs),
      ...(state.selectedVsMemberSetId === setId && !selectedMemberExists
        ? { selectedVsMemberSetId: null, selectedVsMemberId: null }
        : {}),
    })
  },

  reorderVirtualSetMembers: (setId, newOrder) => {
    get().pushHistory()
    set({
      virtualSets: get().virtualSets.map(vs => {
        if (vs.id !== setId) return vs
        const memberMap = new Map(vs.members.map(m => [m.layerId, m]))
        const reordered = newOrder
          .map(id => memberMap.get(id))
          .filter((m): m is NonNullable<typeof m> => m !== undefined)
        const nodes = new Map(vs.tree?.map(node => [node.layerId, node]))
        return { ...vs, members: reordered, ...(vs.tree ? { tree: reordered.map(member => nodes.get(member.layerId)!) } : {}) }
      }),
    })
  },

  setVirtualSetMemberBlendMode: (setId, layerId, blendMode, options) => {
    if (options?.recordHistory !== false) get().pushHistory()
    set({
      virtualSets: get().virtualSets.map(vs =>
        vs.id === setId ? setLayerBlendModeOverride(vs, layerId, blendMode) : vs
      ),
    })
  },

  setVirtualSetMemberOpacity: (setId, layerId, opacity, options) => {
    if (options?.recordHistory !== false) get().pushHistory()
    set({
      virtualSets: get().virtualSets.map(vs =>
        vs.id === setId ? setLayerOpacityOverride(vs, layerId, opacity) : vs
      ),
    })
  },

  setVirtualSetLayerBlendMode: (setId, layerId, blendMode, options) => {
    if (options?.recordHistory !== false) get().pushHistory()
    set({
      virtualSets: get().virtualSets.map(vs =>
        vs.id === setId ? setLayerBlendModeOverride(vs, layerId, blendMode) : vs
      ),
    })
  },

  setVirtualSetLayerOpacity: (setId, layerId, opacity, options) => {
    if (options?.recordHistory !== false) get().pushHistory()
    set({
      virtualSets: get().virtualSets.map(vs =>
        vs.id === setId ? setLayerOpacityOverride(vs, layerId, opacity) : vs
      ),
    })
  },

  setVirtualSetVisibilityOverride: (setId, layerId, visible, options) => {
    if (options?.recordHistory !== false) get().pushHistory()
    set({
      virtualSets: get().virtualSets.map(vs => {
        if (vs.id !== setId) return vs
        return {
          ...vs,
          visibilityOverrides: { ...vs.visibilityOverrides, [layerId]: visible },
        }
      }),
    })
  },
})
