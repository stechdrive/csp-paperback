import type { StateCreator } from 'zustand'
import type { AppStore } from './index'

export interface UiSlice {
  selectedLayerId: string | null
  selectedCellIndex: number
  visibilityOverrides: Map<string, boolean>  // layerId → uiHidden
  expandedFolders: Set<string>
  selectLayer: (layerId: string | null) => void
  selectCell: (index: number) => void
  toggleLayerVisibility: (layerId: string) => void
  toggleFolderExpanded: (layerId: string) => void
  resetVisibility: () => void
}

export const createUiSlice: StateCreator<AppStore, [], [], UiSlice> = (set, get) => ({
  selectedLayerId: null,
  selectedCellIndex: 0,
  visibilityOverrides: new Map(),
  expandedFolders: new Set(),

  selectLayer: (layerId) => {
    set({ selectedLayerId: layerId, selectedCellIndex: 0 })
  },

  selectCell: (index) => {
    set({ selectedCellIndex: index })
  },

  toggleLayerVisibility: (layerId) => {
    const current = new Map(get().visibilityOverrides)
    // 現在の値を反転（未設定はfalse=表示中として扱い、トグルでtrue=非表示）
    const currentHidden = current.get(layerId) ?? false
    current.set(layerId, !currentHidden)
    set({ visibilityOverrides: current })
  },

  toggleFolderExpanded: (layerId) => {
    const current = new Set(get().expandedFolders)
    if (current.has(layerId)) {
      current.delete(layerId)
    } else {
      current.add(layerId)
    }
    set({ expandedFolders: current })
  },

  resetVisibility: () => {
    set({ visibilityOverrides: new Map() })
  },
})
