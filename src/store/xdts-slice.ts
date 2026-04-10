import type { StateCreator } from 'zustand'
import type { CspLayer, XdtsData, XdtsTrack } from '../types'
import { parseXdts } from '../utils/xdts-parser'
import { detectAnimationFoldersByXdts, clearXdtsAnimFolders } from '../engine/tree-builder'
import { sanitizeManualAnimFolderIds } from '../utils/manual-animation-folder'
import { addXdtsUnusedCellHiddenOverrides } from '../utils/default-visibility'
import type { AppStore } from './index'

export interface XdtsSlice {
  xdtsData: XdtsData | null
  xdtsFileName: string | null
  /**
   * XDTS にあるが PSD 側に対応する anim folder 候補が見つからなかったトラック。
   * 不一致警告 UI (ExportDialog) で表示する。
   */
  unmatchedTracks: XdtsTrack[]
  loadXdts: (text: string, fileName: string) => void
  clearXdts: () => void
  setUnmatchedTracks: (tracks: XdtsTrack[]) => void
}

export const createXdtsSlice: StateCreator<AppStore, [], [], XdtsSlice> = (set, get) => ({
  xdtsData: null,
  xdtsFileName: null,
  unmatchedTracks: [],

  setUnmatchedTracks: (tracks) => {
    set({ unmatchedTracks: tracks })
  },

  loadXdts: (text, fileName) => {
    const xdts = parseXdts(text)
    set({ xdtsData: xdts, xdtsFileName: fileName, currentFrame: 0 })

    // PSD 読み込み前に XDTS が来た場合は loadPsd 側で反映されるので何もしない
    const { layerTree } = get()
    if (layerTree.length === 0) return

    // 既存ツリーのフラグをインプレースで更新（ツリー再構築しない＝レイヤーIDを維持）
    clearXdtsAnimFolders(layerTree)
    const assignResult = detectAnimationFoldersByXdts(layerTree, xdts)
    const manualAnimFolderIds = sanitizeManualAnimFolderIds(layerTree, get().manualAnimFolderIds)
    const visibilityOverrides = addXdtsUnusedCellHiddenOverrides(
      layerTree,
      xdts,
      new Map(get().visibilityOverrides),
      false,
    )
    // シャローコピーで再レンダリングをトリガー
    set({ layerTree: [...layerTree], manualAnimFolderIds, visibilityOverrides })
    get().setUnmatchedTracks(assignResult.unmatchedTracks)

    // フレーム0のセルを自動選択して初期プレビューを表示
    const firstAnimFolder = findFirstAnimFolder(layerTree)
    if (firstAnimFolder) {
      get().seekToFrame(0)
      set({ focusedAnimFolderId: firstAnimFolder.id })
    }
  },

  clearXdts: () => {
    const { layerTree } = get()
    set({ xdtsData: null, xdtsFileName: null, currentFrame: 0 })
    if (layerTree.length > 0) {
      clearXdtsAnimFolders(layerTree)
      set({ layerTree: [...layerTree] })
    }
    get().setUnmatchedTracks([])
  },
})

function findFirstAnimFolder(layers: CspLayer[]): CspLayer | null {
  for (const l of layers) {
    if (l.isAnimationFolder) return l
    const found = findFirstAnimFolder(l.children)
    if (found) return found
  }
  return null
}
