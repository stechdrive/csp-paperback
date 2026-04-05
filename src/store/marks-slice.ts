import type { StateCreator } from 'zustand'
import type { SingleMark, VirtualSet } from '../types'
import type { CspLayer } from '../types'
import type { AppStore } from './index'

export interface MarksSlice {
  singleMarks: Map<string, SingleMark>
  virtualSets: VirtualSet[]
  toggleSingleMark: (layerId: string) => void
  addVirtualSet: (name: string) => void
  updateVirtualSet: (id: string, updates: Partial<Omit<VirtualSet, 'id'>>) => void
  removeVirtualSet: (id: string) => void
  addVirtualSetMember: (setId: string, layerId: string) => void
  removeVirtualSetMember: (setId: string, layerId: string) => void
  reorderVirtualSetMembers: (setId: string, newOrder: string[]) => void
  setVirtualSetMemberBlendMode: (setId: string, layerId: string, blendMode: string | null) => void
  setVirtualSetMemberOpacity: (setId: string, layerId: string, opacity: number | null) => void
  setVirtualSetVisibilityOverride: (setId: string, layerId: string, visible: boolean) => void
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
  const globalUiHidden = globalOverrides.get(layer.id) ?? layer.uiHidden
  out[layer.id] = !layer.hidden && !globalUiHidden
  for (const child of layer.children) {
    captureVisibilitySnapshot(child, globalOverrides, out)
  }
}

export const createMarksSlice: StateCreator<AppStore, [], [], MarksSlice> = (set, get) => ({
  singleMarks: new Map(),
  virtualSets: [],

  toggleSingleMark: (layerId) => {
    const current = new Map(get().singleMarks)
    if (current.has(layerId)) {
      current.delete(layerId)
    } else {
      current.set(layerId, { layerId, origin: 'manual' })
    }
    set({ singleMarks: current })
  },

  addVirtualSet: (name) => {
    const newSet: VirtualSet = {
      id: crypto.randomUUID(),
      name,
      insertionLayerId: null,
      insertionPosition: 'above',
      members: [],
      expandToAnimationCells: false,
      visibilityOverrides: {},
    }
    set({ virtualSets: [...get().virtualSets, newSet] })
  },

  updateVirtualSet: (id, updates) => {
    set({
      virtualSets: get().virtualSets.map(vs =>
        vs.id === id ? { ...vs, ...updates } : vs
      ),
    })
  },

  removeVirtualSet: (id) => {
    set({ virtualSets: get().virtualSets.filter(vs => vs.id !== id) })
  },

  addVirtualSetMember: (setId, layerId) => {
    const state = get()
    const vs = state.virtualSets.find(v => v.id === setId)
    if (!vs) return
    if (vs.members.some(m => m.layerId === layerId)) return

    // 追加するレイヤー（フォルダも含む）のサブツリーについて、
    // 現在のグローバル表示状態を初期オーバーライドとして取得する
    const layer = findLayerInTree(state.layerTree, layerId)
    const newOverrides = { ...vs.visibilityOverrides }
    if (layer) {
      captureVisibilitySnapshot(layer, state.visibilityOverrides, newOverrides)
    }

    set({
      virtualSets: state.virtualSets.map(v => {
        if (v.id !== setId) return v
        return {
          ...v,
          members: [{ layerId, blendMode: null, opacity: null }, ...v.members],  // 先頭に追加（上レイヤー扱い）
          visibilityOverrides: newOverrides,
        }
      }),
    })
  },

  removeVirtualSetMember: (setId, layerId) => {
    set({
      virtualSets: get().virtualSets.map(vs => {
        if (vs.id !== setId) return vs
        return { ...vs, members: vs.members.filter(m => m.layerId !== layerId) }
      }),
    })
  },

  reorderVirtualSetMembers: (setId, newOrder) => {
    set({
      virtualSets: get().virtualSets.map(vs => {
        if (vs.id !== setId) return vs
        const memberMap = new Map(vs.members.map(m => [m.layerId, m]))
        const reordered = newOrder
          .map(id => memberMap.get(id))
          .filter((m): m is NonNullable<typeof m> => m !== undefined)
        return { ...vs, members: reordered }
      }),
    })
  },

  setVirtualSetMemberBlendMode: (setId, layerId, blendMode) => {
    set({
      virtualSets: get().virtualSets.map(vs => {
        if (vs.id !== setId) return vs
        return {
          ...vs,
          members: vs.members.map(m =>
            m.layerId === layerId ? { ...m, blendMode } : m
          ),
        }
      }),
    })
  },

  setVirtualSetMemberOpacity: (setId, layerId, opacity) => {
    set({
      virtualSets: get().virtualSets.map(vs => {
        if (vs.id !== setId) return vs
        return {
          ...vs,
          members: vs.members.map(m =>
            m.layerId === layerId ? { ...m, opacity } : m
          ),
        }
      }),
    })
  },

  setVirtualSetVisibilityOverride: (setId, layerId, visible) => {
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
