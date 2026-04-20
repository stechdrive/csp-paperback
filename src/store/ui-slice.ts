import type { StateCreator } from 'zustand'
import type { CspLayer } from '../types'
import type { XdtsTrack } from '../types/xdts'
import { findFirstFrameOfCell, resolveCellsAtFrameByTrackNo } from '../utils/xdts-parser'
import { buildDefaultVisibilityOverrides } from '../utils/default-visibility'
import { DEFAULT_MOBILE_UI_SCALE, clampMobileUiScale } from '../utils/mobile-ui-scale'
import { findTimelineCellChildIndex } from '../utils/anim-cell-selection'
import type { AppTheme } from '../theme'
import { DEFAULT_APP_THEME } from '../theme'
import type { AppStore } from './index'

export interface UiSlice {
  mobileUiScale: number
  activeTheme: AppTheme
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
  /**
   * ユーザーが明示的に閉じたフォルダ。Shift+ホイール巡回で祖先が仮展開されていても、
   * この集合にあるフォルダは閉じたまま表示する（ユーザーの開閉意志を尊重）。
   */
  userCollapsedFolders: Set<string>
  /** タイムラインの現在フレーム（0-based） */
  currentFrame: number
  setMobileUiScale: (scale: number) => void
  setActiveTheme: (theme: AppTheme) => void
  resetMobileUiScale: () => void
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
  /**
   * フォルダの開閉を「視覚状態 → 反対方向」で明示的に設定する。
   * 仮展開（Shift巡回による自動展開）されているフォルダを閉じると、
   * userCollapsedFolders に記録され以降の仮展開を抑制する。
   */
  setFolderExpanded: (layerId: string, expanded: boolean) => void
  setFolderExpandedRecursive: (layerId: string, expanded: boolean) => void
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

function findAnimFolderByTrackNo(
  layers: CspLayer[],
  trackNo: number,
): CspLayer | null {
  for (const l of layers) {
    if (
      l.isAnimationFolder &&
      l.animationFolder?.detectedBy === 'xdts' &&
      l.animationFolder.trackNo === trackNo
    ) {
      return l
    }
    const found = findAnimFolderByTrackNo(l.children, trackNo)
    if (found) return found
  }
  return null
}

// -------------------------------------------------------

export const createUiSlice: StateCreator<AppStore, [], [], UiSlice> = (set, get) => ({
  mobileUiScale: DEFAULT_MOBILE_UI_SCALE,
  activeTheme: DEFAULT_APP_THEME,
  selectedLayerId: null,
  selectedCells: new Map(),
  focusedAnimFolderId: null,
  selectedVirtualSetId: null,
  selectedVsMemberSetId: null,
  selectedVsMemberId: null,
  visibilityOverrides: new Map(),
  expandedFolders: new Set(),
  userCollapsedFolders: new Set(),
  currentFrame: 0,

  setMobileUiScale: (scale) => {
    set({ mobileUiScale: clampMobileUiScale(scale) })
  },

  setActiveTheme: (theme) => {
    set({ activeTheme: theme })
  },

  resetMobileUiScale: () => {
    set({ mobileUiScale: DEFAULT_MOBILE_UI_SCALE })
  },

  selectLayer: (layerId) => {
    set({ selectedLayerId: layerId })
  },

  setSelectedVsMember: (setId, memberId) => {
    set({ selectedVsMemberSetId: setId, selectedVsMemberId: memberId })
  },

  selectAnimCell: (animFolderId, cellIndex) => {
    const { xdtsData, layerTree, selectedCells } = get()
    const newSelectedCells = new Map(selectedCells)
    newSelectedCells.set(animFolderId, cellIndex)
    let resolvedFrame = -1

    if (xdtsData && xdtsData.tracks.length > 0) {
      // 選択されたセルの名前を取得
      const animFolder = findLayerById(layerTree, animFolderId)
      const selectedCell = animFolder?.children[cellIndex]

      if (animFolder && selectedCell) {
        const cellName = selectedCell.originalName
        // XDTS同期は読み込み時に trackNo が確定したフォルダだけが対象。
        // 手動指定フォルダは XDTS トラックと対応しないため、名前フォールバックはしない。
        const track: XdtsTrack | undefined = typeof animFolder.animationFolder?.trackNo === 'number'
          ? xdtsData.tracks.find(t => t.trackNo === animFolder.animationFolder!.trackNo)
          : undefined
        if (track) {
          const frameIndex = findFirstFrameOfCell(track, cellName)
          if (frameIndex >= 0) {
            resolvedFrame = frameIndex
            // そのフレームでの全トラックのセルをホールドルールで解決
            const resolved = resolveCellsAtFrameByTrackNo(xdtsData.tracks, frameIndex)
            for (const [trackNo, resolvedCellName] of resolved) {
              const otherFolder = findAnimFolderByTrackNo(layerTree, trackNo)
              if (!otherFolder) continue
              if (resolvedCellName === null) {
                // SYMBOL_NULL_CELL: カラ（何も表示しない）
                newSelectedCells.set(otherFolder.id, -1)
              } else {
                const idx = findTimelineCellChildIndex(otherFolder, resolvedCellName)
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
    const { xdtsData, layerTree } = get()
    if (!xdtsData || xdtsData.duration <= 0) return
    const clamped = Math.max(0, Math.min(xdtsData.duration - 1, frameIndex))
    const resolved = resolveCellsAtFrameByTrackNo(xdtsData.tracks, clamped)
    const newSelectedCells = new Map<string, number>()
    for (const [trackNo, cellName] of resolved) {
      const folder = findAnimFolderByTrackNo(layerTree, trackNo)
      if (!folder) continue
      if (cellName === null) {
        // カラ（何も表示しない）
        newSelectedCells.set(folder.id, -1)
      } else {
        const idx = findTimelineCellChildIndex(folder, cellName)
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
    const expandedFolders = new Set(get().expandedFolders)
    const userCollapsedFolders = new Set(get().userCollapsedFolders)
    if (expandedFolders.has(layerId)) {
      expandedFolders.delete(layerId)
    } else {
      expandedFolders.add(layerId)
    }
    // 永続状態を直接トグルする場合、明示的な閉じる意志は解除
    userCollapsedFolders.delete(layerId)
    set({ expandedFolders, userCollapsedFolders })
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
    const nextExpanded = new Set(expandedFolders)
    const nextCollapsed = new Set(get().userCollapsedFolders)
    for (const id of ids) {
      if (willExpand) nextExpanded.add(id)
      else nextExpanded.delete(id)
      nextCollapsed.delete(id)
    }
    set({ expandedFolders: nextExpanded, userCollapsedFolders: nextCollapsed })
  },

  setFolderExpanded: (layerId, expanded) => {
    const expandedFolders = new Set(get().expandedFolders)
    const userCollapsedFolders = new Set(get().userCollapsedFolders)
    if (expanded) {
      expandedFolders.add(layerId)
      userCollapsedFolders.delete(layerId)
    } else {
      expandedFolders.delete(layerId)
      userCollapsedFolders.add(layerId)
    }
    set({ expandedFolders, userCollapsedFolders })
  },

  setFolderExpandedRecursive: (layerId, expanded) => {
    const { layerTree } = get()
    const root = findLayerById(layerTree, layerId)
    if (!root) return

    function collectFolderIds(layer: CspLayer): string[] {
      const ids: string[] = layer.isFolder ? [layer.id] : []
      for (const child of layer.children) {
        ids.push(...collectFolderIds(child))
      }
      return ids
    }

    const ids = collectFolderIds(root)
    const nextExpanded = new Set(get().expandedFolders)
    const nextCollapsed = new Set(get().userCollapsedFolders)
    for (const id of ids) {
      if (expanded) {
        nextExpanded.add(id)
        nextCollapsed.delete(id)
      } else {
        nextExpanded.delete(id)
        nextCollapsed.add(id)
      }
    }
    set({ expandedFolders: nextExpanded, userCollapsedFolders: nextCollapsed })
  },

  resetVisibility: () => {
    get().pushHistory()
    const { layerTree, xdtsData } = get()
    set({ visibilityOverrides: buildDefaultVisibilityOverrides(layerTree, xdtsData) })
  },
})
