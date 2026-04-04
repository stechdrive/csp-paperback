import type { StateCreator } from 'zustand'
import type { AnimationFolderMode } from '../types'
import type { AppStore } from './index'

export interface AnimationSlice {
  // 手動指定されたアニメーションフォルダのIDセット
  // （xdts検出分はlayerTree内のanimationFolderプロパティで管理）
  manualAnimFolderIds: Set<string>
  folderModes: Map<string, AnimationFolderMode>
  toggleManualAnimFolder: (layerId: string) => void
  setFolderMode: (layerId: string, mode: AnimationFolderMode) => void
}

export const createAnimationSlice: StateCreator<AppStore, [], [], AnimationSlice> = (set, get) => ({
  manualAnimFolderIds: new Set(),
  folderModes: new Map(),

  toggleManualAnimFolder: (layerId) => {
    const current = new Set(get().manualAnimFolderIds)
    if (current.has(layerId)) {
      current.delete(layerId)
    } else {
      current.add(layerId)
    }
    set({ manualAnimFolderIds: current })
  },

  setFolderMode: (layerId, mode) => {
    const current = new Map(get().folderModes)
    current.set(layerId, mode)
    set({ folderModes: current })
  },
})
