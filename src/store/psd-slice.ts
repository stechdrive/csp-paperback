import type { StateCreator } from 'zustand'
import type { Psd } from 'ag-psd'
import { DEFAULT_OUTPUT_CONFIG, type BlendMode, type CspLayer } from '../types'
import { readPsdFile } from '../utils/psd-io'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../engine/tree-builder'
import { sanitizeManualAnimFolderIds } from '../utils/manual-animation-folder'
import { buildDefaultVisibilityOverrides } from '../utils/default-visibility'
import type { AppStore } from './index'
import type { HistoryOptions } from './history-slice'

export interface PsdSlice {
  rawPsd: Psd | null
  psdFileName: string | null
  psdSourceDirectory: string | null
  layerTree: CspLayer[]
  docWidth: number
  docHeight: number
  docDpiX: number  // pixels per inch (0 = 不明)
  docDpiY: number  // pixels per inch (0 = 不明)
  loadPsd: (buffer: ArrayBuffer, fileName: string, sourceDirectory?: string) => void
  resetProject: () => void
  resetPsd: () => void
  setLayerBlendMode: (layerId: string, blendMode: BlendMode, options?: HistoryOptions) => void
  setLayerOpacity: (layerId: string, opacity: number, options?: HistoryOptions) => void
}

function findFirstAnimFolder(layers: CspLayer[]): CspLayer | null {
  for (const l of layers) {
    if (l.isAnimationFolder) return l
    const found = findFirstAnimFolder(l.children)
    if (found) return found
  }
  return null
}

function updateLayerBlendMode(
  layers: CspLayer[],
  layerId: string,
  blendMode: BlendMode,
): { layers: CspLayer[]; changed: boolean } {
  let changed = false
  const next = layers.map(layer => {
    if (layer.id === layerId) {
      if (layer.blendMode === blendMode) return layer
      layer.agPsdRef.blendMode = blendMode
      changed = true
      return { ...layer, blendMode }
    }

    if (layer.children.length === 0) return layer
    const childResult = updateLayerBlendMode(layer.children, layerId, blendMode)
    if (!childResult.changed) return layer
    changed = true
    return { ...layer, children: childResult.layers }
  })

  return { layers: changed ? next : layers, changed }
}

function updateLayerOpacity(
  layers: CspLayer[],
  layerId: string,
  opacity: number,
): { layers: CspLayer[]; changed: boolean } {
  let changed = false
  const next = layers.map(layer => {
    if (layer.id === layerId) {
      if (layer.opacity === opacity) return layer
      // agPsdRef.opacity は ag-psd が 0〜1 スケールで扱う
      layer.agPsdRef.opacity = opacity / 100
      changed = true
      return { ...layer, opacity }
    }

    if (layer.children.length === 0) return layer
    const childResult = updateLayerOpacity(layer.children, layerId, opacity)
    if (!childResult.changed) return layer
    changed = true
    return { ...layer, children: childResult.layers }
  })

  return { layers: changed ? next : layers, changed }
}

export const createPsdSlice: StateCreator<AppStore, [], [], PsdSlice> = (set, get) => ({
  rawPsd: null,
  psdFileName: null,
  psdSourceDirectory: null,
  layerTree: [],
  docWidth: 0,
  docHeight: 0,
  docDpiX: 0,
  docDpiY: 0,

  loadPsd: (buffer, fileName, sourceDirectory) => {
    const psd = readPsdFile(buffer)
    const xdts = get().xdtsData ?? undefined
    const { archivePatterns, autoMarkFolderNames } = get().projectSettings
    const tree = buildLayerTree(psd, xdts, archivePatterns, autoMarkFolderNames)

    // XDTS があれば anim folder 検出を実行し、警告 UI 用に unmatchedTracks を保存
    if (xdts) {
      const assignResult = detectAnimationFoldersByXdts(tree, xdts)
      get().setUnmatchedTracks(assignResult.unmatchedTracks)
    } else {
      get().setUnmatchedTracks([])
    }

    // DPI情報を取得（PPI/PPCMどちらでもPPIに統一）
    const res = psd.imageResources?.resolutionInfo
    const toPpi = (v: number, unit: 'PPI' | 'PPCM') =>
      unit === 'PPCM' ? Math.round(v * 2.54) : Math.round(v)
    const dpiX = res ? toPpi(res.horizontalResolution, res.horizontalResolutionUnit) : 0
    const dpiY = res ? toPpi(res.verticalResolution, res.verticalResolutionUnit) : 0

    // layer.expanded = true なフォルダを expandedFolders の初期値に
    const initialExpanded = new Set<string>()
    function collectExpanded(layers: CspLayer[]): void {
      for (const l of layers) {
        if (l.isFolder && l.expanded) initialExpanded.add(l.id)
        collectExpanded(l.children)
      }
    }
    collectExpanded(tree)

    const initialVisibility = buildDefaultVisibilityOverrides(tree, xdts, !!get().projectSettings.sharedCutMode)

    const manualAnimFolderIds = sanitizeManualAnimFolderIds(tree, get().manualAnimFolderIds)

    set({
      rawPsd: psd,
      psdFileName: fileName,
      psdSourceDirectory: sourceDirectory ?? null,
      layerTree: tree,
      docWidth: psd.width,
      docHeight: psd.height,
      docDpiX: dpiX,
      docDpiY: dpiY,
      // PSD読み込み時にUI状態・履歴をリセット（レイヤーIDが変わるため履歴は無効）
      selectedLayerId: null,
      selectedCells: new Map(),
      focusedAnimFolderId: null,
      visibilityOverrides: initialVisibility,
      expandedFolders: initialExpanded,
      userCollapsedFolders: new Set(),
      manualAnimFolderIds,
      _past: [],
      _future: [],
      canUndo: false,
      canRedo: false,
    })

    // XDTS既読み込みの場合、フレーム0のセルを自動選択して初期プレビューを表示
    if (xdts) {
      const firstAnimFolder = findFirstAnimFolder(tree)
      if (firstAnimFolder) {
        get().seekToFrame(0)
        set({ focusedAnimFolderId: firstAnimFolder.id })
      }
    }
  },

  resetPsd: () => {
    get().resetProject()
  },

  resetProject: () => {
    set({
      rawPsd: null,
      psdFileName: null,
      psdSourceDirectory: null,
      layerTree: [],
      docWidth: 0,
      docHeight: 0,
      docDpiX: 0,
      docDpiY: 0,
      xdtsData: null,
      xdtsFileName: null,
      xdtsSourceDirectory: null,
      unmatchedTracks: [],
      singleMarks: new Map(),
      virtualSets: [],
      manualAnimFolderIds: new Set(),
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
      outputConfig: DEFAULT_OUTPUT_CONFIG,
      _past: [],
      _future: [],
      canUndo: false,
      canRedo: false,
    })
  },

  setLayerBlendMode: (layerId, blendMode, options) => {
    const result = updateLayerBlendMode(get().layerTree, layerId, blendMode)
    if (!result.changed) return
    if (options?.recordHistory !== false) get().pushHistory()
    set({ layerTree: result.layers })
  },

  setLayerOpacity: (layerId, opacity, options) => {
    const clamped = Math.max(0, Math.min(100, opacity))
    const result = updateLayerOpacity(get().layerTree, layerId, clamped)
    if (!result.changed) return
    if (options?.recordHistory !== false) get().pushHistory()
    set({ layerTree: result.layers })
  },
})
