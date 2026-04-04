import type { StateCreator } from 'zustand'
import type { SingleMark, VirtualSet } from '../types'
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
      memberLayerIds: [],
      expandToAnimationCells: false,
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
    set({
      virtualSets: get().virtualSets.map(vs => {
        if (vs.id !== setId) return vs
        if (vs.memberLayerIds.includes(layerId)) return vs
        return { ...vs, memberLayerIds: [...vs.memberLayerIds, layerId] }
      }),
    })
  },

  removeVirtualSetMember: (setId, layerId) => {
    set({
      virtualSets: get().virtualSets.map(vs => {
        if (vs.id !== setId) return vs
        return { ...vs, memberLayerIds: vs.memberLayerIds.filter(id => id !== layerId) }
      }),
    })
  },
})
