import type { StateCreator } from 'zustand'
import type { CspLayer } from '../types'
import type { TimelineTrack } from '../types/timeline'
import { findFirstFrameOfCell, resolveCellsAtFrameByTrackNo } from '../utils/xdts-parser'
import { buildDefaultVisibilityOverrides } from '../utils/default-visibility'
import { DEFAULT_MOBILE_UI_SCALE, clampMobileUiScale } from '../utils/mobile-ui-scale'
import { selectLayerTreeWithVisibility, selectOutputNavigation, selectOutputFiles } from './selectors'
import { collectOutputRevealFolders, type OutputNavigationEntry } from '../utils/output-navigation'
import { findLayerPath } from '../utils/layerNavigation'
import { findTimelineCellChildIndex } from '../utils/anim-cell-selection'
import type { AppTheme } from '../theme'
import { DEFAULT_APP_THEME } from '../theme'
import type { AppStore } from './index'
import type { HistoryOptions } from './history-slice'
import { emptyOutputSelection, outputSelectionPatch, type OutputSelectionOptions } from './output-selection'
import { cellOutputId, virtualOutputId } from '../utils/output-identity'

export interface UiSlice {
  activeOutputId: string | null
  activeOutputLabel: string
  selectedOutputIds: Set<string>
  outputSelectionAnchor: string | null
  outputViewMode: 'tiles' | 'single'
  outputSearch: string
  quickLookTarget: { layerId: string; virtualSetId?: string } | null
  selectOutputFile: (id: string, options?: OutputSelectionOptions) => void
  setOutputViewMode: (mode: 'tiles' | 'single') => void
  openQuickLook: (layerId: string, virtualSetId?: string) => void
  closeQuickLook: () => void
  mobileUiScale: number
  activeTheme: AppTheme
  selectedLayerId: string | null
  /** Current output's source, retained for timeline navigation. Not the editor row. */
  selectedOutputSourceId: string | null
  /** animFolderId → 選択中のセルインデックス。未登録は先頭（0）扱い。-1 はカラ（何も表示しない） */
  selectedCells: Map<string, number>
  /** 出力プレビューに表示するアニメーションフォルダのID */
  focusedAnimFolderId: string | null
  /** 仮想セルの編集対象。出力選択・タイムラインとは独立。 */
  selectedVirtualSetId: string | null
  /** 仮想セットパネルでコントロール対象のメンバー */
  selectedVsMemberSetId: string | null
  selectedVsMemberId: string | null
  manualVisibilityIds: Set<string>
  visibilityOverrides: Map<string, boolean>  // layerId → uiHidden
  expandedFolders: Set<string>
  /** Temporary reveal only; never persisted or copied into manual expansion preferences. */
  transientExpandedFolders: Set<string>
  /**
   * ユーザーが明示的に閉じたフォルダ。Shift+ホイール巡回で祖先が仮展開されていても、
   * 手動設定の記録。次の巡回は必要な経路だけ再び一時展開する。
   */
  userCollapsedFolders: Set<string>
  /** タイムラインの現在フレーム（0-based） */
  currentFrame: number
  setMobileUiScale: (scale: number) => void
  setActiveTheme: (theme: AppTheme) => void
  resetMobileUiScale: () => void
  selectLayer: (layerId: string | null) => void
  selectOutputEntry: (entry: OutputNavigationEntry, options?: OutputSelectionOptions) => OutputNavigationEntry | undefined
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
  toggleLayerVisibility: (layerId: string, options?: HistoryOptions) => void
  toggleFolderExpanded: (layerId: string) => void
  toggleFolderExpandedRecursive: (layerId: string) => void
  /**
   * フォルダの開閉を「視覚状態 → 反対方向」で明示的に設定する。
   * 仮展開（Shift巡回による自動展開）されているフォルダを閉じると、
   * 現在の仮展開を解除する。次の巡回では出力行まで再度一時展開する。
   */
  setFolderExpanded: (layerId: string, expanded: boolean) => void
  setFolderExpandedRecursive: (layerId: string, expanded: boolean) => void
  resetVisibility: () => void
}

// --------- ツリー走査ヘルパー（スライス内部用）---------

function sameSelectedCells(a: Map<string, number>, b: Map<string, number>): boolean {
  return a.size === b.size && [...a].every(([id, index]) => b.get(id) === index)
}

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
      (l.animationFolder?.detectedBy === 'xdts' || l.animationFolder?.detectedBy === 'clip') &&
      l.animationFolder.trackNo === trackNo
    ) {
      return l
    }
    const found = findAnimFolderByTrackNo(l.children, trackNo)
    if (found) return found
  }
  return null
}

function animationSelection(state: AppStore, animFolderId: string, cellIndex: number): Partial<AppStore> {
  const { timelineData, layerTree, selectedCells } = state
  const newSelectedCells = new Map(selectedCells)
  let resolvedFrame = -1

  if (timelineData && timelineData.tracks.length > 0) {
    // 選択されたセルの名前を取得
    const animFolder = findLayerById(layerTree, animFolderId)
    const selectedCell = animFolder?.children[cellIndex]

    if (animFolder && selectedCell) {
      const cellName = selectedCell.originalName
      // XDTS同期は読み込み時に trackNo が確定したフォルダだけが対象。
      // 手動指定フォルダは XDTS トラックと対応しないため、名前フォールバックはしない。
      const track: TimelineTrack | undefined = typeof animFolder.animationFolder?.trackNo === 'number'
        ? timelineData.tracks.find(t => t.trackNo === animFolder.animationFolder!.trackNo)
        : undefined
      if (track) {
        const frameIndex = findFirstFrameOfCell(track, cellName)
        if (frameIndex >= 0) {
          resolvedFrame = frameIndex
          // そのフレームでの全トラックのセルをホールドルールで解決
          const resolved = resolveCellsAtFrameByTrackNo(timelineData.tracks, frameIndex)
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

  // Explicit selection wins when the same track contains duplicate cel names.
  // Timeline seeking can still use its normal name-based tie breaking.
  newSelectedCells.set(animFolderId, cellIndex)
  const update: Partial<AppStore> = {
    selectedCells: sameSelectedCells(selectedCells, newSelectedCells) ? selectedCells : newSelectedCells,
    focusedAnimFolderId: animFolderId,
  }
  if (resolvedFrame >= 0) update.currentFrame = resolvedFrame
  return update
}

// -------------------------------------------------------

export const createUiSlice: StateCreator<AppStore, [], [], UiSlice> = (set, get) => ({
  ...emptyOutputSelection(),
  selectOutputFile: (id, options) => {
    const state = get()
    const file = selectOutputFiles(state).find(file => file.outputId === id)
    if (file) {
      const entry = selectOutputNavigation(state).entries.find(entry => entry.id === file.sourceLayerId)
      if (entry) state.selectOutputEntry(entry, options)
    } else {
      const draft = state.virtualSets.find(vs => !vs.insertionLayerId && virtualOutputId(vs.id) === id)
      if (draft) set(outputSelectionPatch(state, id, draft.name, options))
    }
  },
  setOutputViewMode: outputViewMode => set({ outputViewMode }),
  openQuickLook: (layerId, virtualSetId) => set({ quickLookTarget: { layerId, virtualSetId } }),
  closeQuickLook: () => set({ quickLookTarget: null }),
  mobileUiScale: DEFAULT_MOBILE_UI_SCALE,
  activeTheme: DEFAULT_APP_THEME,
  selectedLayerId: null,
  selectedOutputSourceId: null,
  selectedCells: new Map(),
  focusedAnimFolderId: null,
  selectedVirtualSetId: null,
  selectedVsMemberSetId: null,
  selectedVsMemberId: null,
  visibilityOverrides: new Map(),
  manualVisibilityIds: new Set(),
  expandedFolders: new Set(),
  transientExpandedFolders: new Set(),
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
    const state = get()
    const layer = layerId ? findLayerPath(state.layerTree, layerId).at(-1) : null
    set({ selectedLayerId: layer?.id ?? null })
  },

  selectOutputEntry: (requested, options) => {
    const state = get()
    const navigation = selectOutputNavigation(state)
    const entry = navigation.entries.find(item => item.id === requested.id && item.kind === requested.kind)
    if (!entry) return
    const file = selectOutputFiles(state).find(file => file.sourceLayerId === entry.id)
    if (!file) return
    const outputSelection = outputSelectionPatch(state, file.outputId, file.relativePath, options)
    outputSelection.transientExpandedFolders = options?.reveal
      ? collectOutputRevealFolders(selectLayerTreeWithVisibility(state), navigation, entry.kind === 'layer' ? entry.id : null, entry.kind === 'virtualSet' ? entry.id : null)
      : new Set()
    if (entry.kind === 'virtualSet') {
      set({ ...outputSelection, selectedOutputSourceId: entry.id, focusedAnimFolderId: null })
    } else {
      const update = !options?.preserveTimeline && entry.animFolderId !== undefined && entry.cellIndex !== undefined
        ? animationSelection(state, entry.animFolderId, entry.cellIndex) : {}
      set({ ...update, ...outputSelection, selectedOutputSourceId: entry.id,
        focusedAnimFolderId: entry.animFolderId ?? null })
    }
    return entry
  },

  setSelectedVsMember: (setId, memberId) => {
    set({ selectedVsMemberSetId: setId, selectedVsMemberId: memberId })
  },

  selectAnimCell: (animFolderId, cellIndex) => {
    const state = get()
    const tree = selectLayerTreeWithVisibility(state)
    const folder = findLayerById(tree, animFolderId)
    if (!folder?.isAnimationFolder) return
    const file = selectOutputFiles(state).find(file => file.animFolderId === animFolderId && file.sourceCellId === folder.children[cellIndex]?.id)
    set({ ...animationSelection(state, animFolderId, cellIndex),
      ...outputSelectionPatch(state, file?.outputId ?? cellOutputId(animFolderId, folder.children[cellIndex]?.id ?? ''), file?.relativePath ?? 'カラセル'),
      selectedOutputSourceId: file?.sourceLayerId ?? null })
  },

  seekToFrame: (frameIndex) => {
    const { timelineData, layerTree, selectedCells } = get()
    if (!timelineData || timelineData.duration <= 0) return
    const clamped = Math.max(0, Math.min(timelineData.duration - 1, frameIndex))
    const resolved = resolveCellsAtFrameByTrackNo(timelineData.tracks, clamped)
    // Untimed/manual folders keep their chosen cel when the playhead moves.
    const newSelectedCells = new Map([...selectedCells].filter(([id]) => findLayerById(layerTree, id)))
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
    const tree = selectLayerTreeWithVisibility(get())
    const focus = get().focusedAnimFolderId
    const folder = focus ? findLayerById(tree, focus) : null
    const selection: Partial<AppStore> = {}
    if (folder?.isAnimationFolder && focus && newSelectedCells.has(focus) &&
      selectedCells.get(focus) !== newSelectedCells.get(focus)) {
      const nextIndex = newSelectedCells.get(focus)!
      const nextCell = folder.children[nextIndex]
      const previous = get().activeOutputId ? JSON.parse(get().activeOutputId!) as string[] : []
      const id = cellOutputId(focus, nextCell?.id ?? '', previous[0] === 'cell' && previous[3] === 'process' ? previous[4] : undefined)
      const file = selectOutputFiles(get()).find(file => file.outputId === id)
      Object.assign(selection, outputSelectionPatch(get(), id, file?.relativePath ?? (nextCell?.name ?? 'カラセル')),
        { selectedOutputSourceId: file?.sourceLayerId ?? null })
    }
    set({ ...selection, currentFrame: clamped,
      selectedCells: sameSelectedCells(selectedCells, newSelectedCells) ? selectedCells : newSelectedCells })
  },

  setFocusedAnimFolder: (id) => {
    if (id) get().selectAnimCell(id, get().selectedCells.get(id) ?? 0)
    else set({ focusedAnimFolderId: null })
  },

  setSelectedVirtualSet: (id) => {
    const state = get()
    const selectedVirtualSetId = state.virtualSets.some(vs => vs.id === id) ? id : null
    set({ selectedVirtualSetId })
  },

  toggleLayerVisibility: (layerId, options) => {
    if (options?.recordHistory !== false) get().pushHistory()
    const current = new Map(get().visibilityOverrides)
    // 実効的な非表示状態を判定: 既存 override があればその値、なければ PSD の hidden/uiHidden を参照
    const layer = findLayerById(get().layerTree, layerId)
    const effectivelyHidden = current.has(layerId)
      ? current.get(layerId)!
      : (layer ? (layer.hidden || layer.uiHidden) : false)
    current.set(layerId, !effectivelyHidden)
    set({ visibilityOverrides: current, manualVisibilityIds: new Set([...get().manualVisibilityIds, layerId]) })
  },

  toggleFolderExpanded: (layerId) => {
    const state = get()
    state.setFolderExpanded(layerId, !(state.expandedFolders.has(layerId) || state.transientExpandedFolders.has(layerId)))
  },

  toggleFolderExpandedRecursive: (layerId) => {
    const state = get()
    state.setFolderExpandedRecursive(layerId, !(state.expandedFolders.has(layerId) || state.transientExpandedFolders.has(layerId)))
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
    const transientExpandedFolders = new Set(get().transientExpandedFolders)
    transientExpandedFolders.delete(layerId)
    set({ expandedFolders, userCollapsedFolders, transientExpandedFolders })
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
    const transientExpandedFolders = new Set(get().transientExpandedFolders)
    for (const id of ids) transientExpandedFolders.delete(id)
    set({ expandedFolders: nextExpanded, userCollapsedFolders: nextCollapsed, transientExpandedFolders })
  },

  resetVisibility: () => {
    get().pushHistory()
    const { layerTree, timelineData, projectSettings } = get()
    set({ visibilityOverrides: buildDefaultVisibilityOverrides(layerTree, timelineData, !!projectSettings.sharedCutMode,
      projectSettings.showIndividualFoldersOnLoad !== false), manualVisibilityIds: new Set() })
  },
})
