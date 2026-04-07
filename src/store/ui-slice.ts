import type { StateCreator } from 'zustand'
import type { CspLayer } from '../types'
import type { XdtsTrack } from '../types/xdts'
import { findFirstFrameOfCell, resolveCellsAtFrame } from '../utils/xdts-parser'
import type { AppStore } from './index'

export interface UiSlice {
  selectedLayerId: string | null
  /** animFolderId → 選択中のセルインデックス。未登録は先頭（0）扱い。-1 はカラ（何も表示しない） */
  selectedCells: Map<string, number>
  /** 出力プレビューに表示するアニメーションフォルダのID */
  focusedAnimFolderId: string | null
  /** 出力プレビューに表示する仮想セットのID（focusedAnimFolderIdと排他） */
  selectedVirtualSetId: string | null
  /** 仮想セットパネルでコントロール対象のメンバー */
  selectedVsMemberSetId: string | null
  selectedVsMemberId: string | null
  visibilityOverrides: Map<string, boolean>  // layerId → uiHidden
  expandedFolders: Set<string>
  /** タイムラインの現在フレーム（0-based） */
  currentFrame: number
  selectLayer: (layerId: string | null) => void
  setSelectedVsMember: (setId: string | null, memberId: string | null) => void
  /**
   * アニメーションフォルダの選択セルを変更する。
   * XDTSが読み込まれている場合、選択セルが最初に登場するフレームを基準に
   * 他トラックのセルをホールドルールで解決して selectedCells をまとめて更新する。
   */
  selectAnimCell: (animFolderId: string, cellIndex: number) => void
  /** タイムラインのフレーム位置から全トラックのセルを解決して selectedCells を更新する */
  seekToFrame: (frameIndex: number) => void
  setFocusedAnimFolder: (id: string | null) => void
  setSelectedVirtualSet: (id: string | null) => void
  toggleLayerVisibility: (layerId: string) => void
  toggleFolderExpanded: (layerId: string) => void
  toggleFolderExpandedRecursive: (layerId: string) => void
  resetVisibility: () => void
}

// --------- ツリー走査ヘルパー（スライス内部用）---------

function findLayerById(layers: CspLayer[], id: string): CspLayer | null {
  for (const l of layers) {
    if (l.id === id) return l
    const found = findLayerById(l.children, id)
    if (found) return found
  }
  return null
}

function findAnimFolderByTrackName(
  layers: CspLayer[],
  trackName: string,
  manualIds: Set<string>,
): CspLayer | null {
  for (const l of layers) {
    if ((l.isAnimationFolder || manualIds.has(l.id)) && l.originalName === trackName) return l
    const found = findAnimFolderByTrackName(l.children, trackName, manualIds)
    if (found) return found
  }
  return null
}

// -------------------------------------------------------

export const createUiSlice: StateCreator<AppStore, [], [], UiSlice> = (set, get) => ({
  selectedLayerId: null,
  selectedCells: new Map(),
  focusedAnimFolderId: null,
  selectedVirtualSetId: null,
  selectedVsMemberSetId: null,
  selectedVsMemberId: null,
  visibilityOverrides: new Map(),
  expandedFolders: new Set(),
  currentFrame: 0,

  selectLayer: (layerId) => {
    set({ selectedLayerId: layerId })
  },

  setSelectedVsMember: (setId, memberId) => {
    set({ selectedVsMemberSetId: setId, selectedVsMemberId: memberId })
  },

  selectAnimCell: (animFolderId, cellIndex) => {
    const { xdtsData, layerTree, manualAnimFolderIds, selectedCells } = get()
    const newSelectedCells = new Map(selectedCells)
    newSelectedCells.set(animFolderId, cellIndex)
    let resolvedFrame = -1

    if (xdtsData && xdtsData.tracks.length > 0) {
      // 選択されたセルの名前を取得
      const animFolder = findLayerById(layerTree, animFolderId)
      const selectedCell = animFolder?.children[cellIndex]

      if (animFolder && selectedCell) {
        const cellName = selectedCell.originalName
        // このフォルダに対応するXDTSトラックを探す（トラック名 = フォルダ名）
        const track: XdtsTrack | undefined = xdtsData.tracks.find(
          t => t.name === animFolder.originalName
        )
        if (track) {
          const frameIndex = findFirstFrameOfCell(track, cellName)
          if (frameIndex >= 0) {
            resolvedFrame = frameIndex
            // そのフレームでの全トラックのセルをホールドルールで解決
            const resolved = resolveCellsAtFrame(xdtsData.tracks, frameIndex)
            for (const [trackName, resolvedCellName] of resolved) {
              const otherFolder = findAnimFolderByTrackName(layerTree, trackName, manualAnimFolderIds)
              if (!otherFolder) continue
              if (resolvedCellName === null) {
                // SYMBOL_NULL_CELL: カラ（何も表示しない）
                newSelectedCells.set(otherFolder.id, -1)
              } else {
                const idx = otherFolder.children.findIndex(
                  c => c.originalName === resolvedCellName
                )
                if (idx >= 0) newSelectedCells.set(otherFolder.id, idx)
              }
            }
          }
        }
      }
    }

    const update: Partial<AppStore> = { selectedCells: newSelectedCells, focusedAnimFolderId: animFolderId, selectedVirtualSetId: null }
    if (resolvedFrame >= 0) update.currentFrame = resolvedFrame
    set(update as AppStore)
  },

  seekToFrame: (frameIndex) => {
    const { xdtsData, layerTree, manualAnimFolderIds } = get()
    if (!xdtsData || xdtsData.duration <= 0) return
    const clamped = Math.max(0, Math.min(xdtsData.duration - 1, frameIndex))
    const resolved = resolveCellsAtFrame(xdtsData.tracks, clamped)
    const newSelectedCells = new Map<string, number>()
    for (const [trackName, cellName] of resolved) {
      const folder = findAnimFolderByTrackName(layerTree, trackName, manualAnimFolderIds)
      if (!folder) continue
      if (cellName === null) {
        // カラ（何も表示しない）
        newSelectedCells.set(folder.id, -1)
      } else {
        const idx = folder.children.findIndex(c => c.originalName === cellName)
        if (idx >= 0) newSelectedCells.set(folder.id, idx)
      }
    }
    set({ currentFrame: clamped, selectedCells: newSelectedCells })
  },

  setFocusedAnimFolder: (id) => {
    set({ focusedAnimFolderId: id, selectedVirtualSetId: null })
  },

  setSelectedVirtualSet: (id) => {
    set({ selectedVirtualSetId: id, focusedAnimFolderId: null })
  },

  toggleLayerVisibility: (layerId) => {
    get().pushHistory()
    const current = new Map(get().visibilityOverrides)
    // 実効的な非表示状態を判定: 既存 override があればその値、なければ PSD の hidden/uiHidden を参照
    const layer = findLayerById(get().layerTree, layerId)
    const effectivelyHidden = current.has(layerId)
      ? current.get(layerId)!
      : (layer ? (layer.hidden || layer.uiHidden) : false)
    current.set(layerId, !effectivelyHidden)
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

  toggleFolderExpandedRecursive: (layerId) => {
    const { layerTree, expandedFolders } = get()
    const root = findLayerById(layerTree, layerId)
    if (!root) return

    // クリックしたフォルダの現在状態で開閉方向を決定
    const willExpand = !expandedFolders.has(layerId)

    // 対象フォルダ以下のすべてのフォルダIDを収集
    function collectFolderIds(layer: CspLayer): string[] {
      const ids: string[] = layer.isFolder ? [layer.id] : []
      for (const child of layer.children) {
        ids.push(...collectFolderIds(child))
      }
      return ids
    }

    const ids = collectFolderIds(root)
    const current = new Set(expandedFolders)
    for (const id of ids) {
      if (willExpand) current.add(id)
      else current.delete(id)
    }
    set({ expandedFolders: current })
  },

  resetVisibility: () => {
    get().pushHistory()
    set({ visibilityOverrides: new Map() })
  },
})
