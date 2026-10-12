import type { StateCreator } from 'zustand'
import type { CspLayer, TimelineData, TimelineTrack } from '../types'
import { parseXdts } from '../utils/xdts-parser'
import { detectAnimationFoldersByXdts, clearXdtsAnimFolders } from '../engine/tree-builder'
import { sanitizeManualAnimFolderIds } from '../utils/manual-animation-folder'
import { addXdtsAnimationFolderShowOverrides, addXdtsUnusedCellHiddenOverrides } from '../utils/default-visibility'
import type { AppStore } from './index'
import { normalizePreviewSelection } from './selection-validity'

export interface XdtsSlice {
  timelineData: TimelineData | null
  xdtsFileName: string | null
  xdtsSourceDirectory: string | null
  /**
   * XDTS にあるが PSD 側に対応する anim folder 候補が見つからなかったトラック。
   * 不一致警告 UI (ExportDialog) で表示する。
   */
  unmatchedTracks: TimelineTrack[]
  loadXdts: (text: string, fileName: string, sourceDirectory?: string) => void
  clearXdts: () => void
  setUnmatchedTracks: (tracks: TimelineTrack[]) => void
}

export const createXdtsSlice: StateCreator<AppStore, [], [], XdtsSlice> = (set, get) => ({
  timelineData: null,
  xdtsFileName: null,
  xdtsSourceDirectory: null,
  unmatchedTracks: [],

  setUnmatchedTracks: (tracks) => {
    set({ unmatchedTracks: tracks })
  },

  loadXdts: (text, fileName, sourceDirectory) => {
    if (get().clipDocument) throw new Error('CLIPのタイムラインを使用中です。PSD＋XDTSへ切り替える場合は2ファイルを一緒に開いてください')
    const xdts = parseXdts(text)
    set({
      timelineData: xdts,
      xdtsFileName: fileName,
      xdtsSourceDirectory: sourceDirectory ?? null,
      currentFrame: 0,
    })

    // PSD 読み込み前に XDTS が来た場合は loadPsd 側で反映されるので何もしない
    const { layerTree } = get()
    if (layerTree.length === 0) return

    // 既存ツリーのフラグをインプレースで更新（ツリー再構築しない＝レイヤーIDを維持）
    clearXdtsAnimFolders(layerTree)
    const assignResult = detectAnimationFoldersByXdts(layerTree, xdts)
    const manualAnimFolderIds = sanitizeManualAnimFolderIds(layerTree, get().manualAnimFolderIds)
    const visibilityOverrides = get().projectSettings.sharedCutMode
      ? addXdtsAnimationFolderShowOverrides(layerTree, new Map(get().visibilityOverrides))
      : addXdtsUnusedCellHiddenOverrides(
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
      get().setFocusedAnimFolder(firstAnimFolder.id)
      get().seekToFrame(0)
    }
  },

  clearXdts: () => {
    if (get().clipDocument) return
    const { layerTree } = get()
    clearXdtsAnimFolders(layerTree)
    const nextState: Partial<AppStore> = {
      timelineData: null, xdtsFileName: null, xdtsSourceDirectory: null, currentFrame: 0,
      layerTree: [...layerTree], unmatchedTracks: [],
    }
    set({ ...nextState, ...normalizePreviewSelection({ ...get(), ...nextState }) })
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
