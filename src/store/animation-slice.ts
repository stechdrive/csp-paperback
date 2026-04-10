import type { StateCreator } from 'zustand'
import { canEnableManualAnimFolder } from '../utils/manual-animation-folder'
import type { AppStore } from './index'

export interface AnimationSlice {
  // 手動指定されたアニメーションフォルダのIDセット
  // （xdts検出分はlayerTree内のanimationFolderプロパティで管理）
  manualAnimFolderIds: Set<string>
  toggleManualAnimFolder: (layerId: string) => void
}

export const createAnimationSlice: StateCreator<AppStore, [], [], AnimationSlice> = (set, get) => ({
  manualAnimFolderIds: new Set(),

  toggleManualAnimFolder: (layerId) => {
    const current = new Set(get().manualAnimFolderIds)
    if (current.has(layerId)) {
      get().pushHistory()
      current.delete(layerId)
      set({ manualAnimFolderIds: current })
      return
    }

    if (!canEnableManualAnimFolder(get().layerTree, layerId, current)) return

    get().pushHistory()
    current.add(layerId)
    set({ manualAnimFolderIds: current })
  },
})
