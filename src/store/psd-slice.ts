import type { StateCreator } from 'zustand'
import type { Psd } from 'ag-psd'
import type { BlendMode, CspLayer } from '../types'
import { readPsdFile } from '../utils/psd-io'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../engine/tree-builder'
import { sanitizeManualAnimFolderIds } from '../utils/manual-animation-folder'
import type { AppStore } from './index'

export interface PsdSlice {
  rawPsd: Psd | null
  psdFileName: string | null
  layerTree: CspLayer[]
  docWidth: number
  docHeight: number
  docDpiX: number  // pixels per inch (0 = 不明)
  docDpiY: number  // pixels per inch (0 = 不明)
  loadPsd: (buffer: ArrayBuffer, fileName: string) => void
  resetPsd: () => void
  setLayerBlendMode: (layerId: string, blendMode: BlendMode) => void
  setLayerOpacity: (layerId: string, opacity: number) => void
}

function findFirstAnimFolder(layers: CspLayer[]): CspLayer | null {
  for (const l of layers) {
    if (l.isAnimationFolder) return l
    const found = findFirstAnimFolder(l.children)
    if (found) return found
  }
  return null
}

export const createPsdSlice: StateCreator<AppStore, [], [], PsdSlice> = (set, get) => ({
  rawPsd: null,
  psdFileName: null,
  layerTree: [],
  docWidth: 0,
  docHeight: 0,
  docDpiX: 0,
  docDpiY: 0,

  loadPsd: (buffer, fileName) => {
    const psd = readPsdFile(buffer)
    const xdts = get().xdtsData ?? undefined
    const archivePatterns = get().projectSettings.archivePatterns
    const tree = buildLayerTree(psd, xdts, archivePatterns)

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

    // autoMarked かつ PSD上で非表示の _フォルダを自動表示（visibilityOverrides に登録）
    // archivePatterns 一致フォルダは autoMarked=false なので自動的に除外される
    const initialVisibility = new Map<string, boolean>()
    function collectAutoShow(layers: CspLayer[]): void {
      for (const l of layers) {
        if (l.autoMarked && l.hidden) initialVisibility.set(l.id, false)
        collectAutoShow(l.children)
      }
    }
    collectAutoShow(tree)

    const manualAnimFolderIds = sanitizeManualAnimFolderIds(tree, get().manualAnimFolderIds)

    set({
      rawPsd: psd,
      psdFileName: fileName,
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
    set({
      rawPsd: null,
      psdFileName: null,
      layerTree: [],
      docWidth: 0,
      docHeight: 0,
      docDpiX: 0,
      docDpiY: 0,
    })
  },

  setLayerBlendMode: (layerId, blendMode) => {
    const updateTree = (layers: CspLayer[]): CspLayer[] =>
      layers.map(l => {
        if (l.id === layerId) {
          l.agPsdRef.blendMode = blendMode
          return { ...l, blendMode }
        }
        if (l.children.length > 0) {
          const newChildren = updateTree(l.children)
          if (newChildren !== l.children) return { ...l, children: newChildren }
        }
        return l
      })
    set(s => ({ layerTree: updateTree(s.layerTree) }))
  },

  setLayerOpacity: (layerId, opacity) => {
    const clamped = Math.max(0, Math.min(100, opacity))
    const updateTree = (layers: CspLayer[]): CspLayer[] =>
      layers.map(l => {
        if (l.id === layerId) {
          // agPsdRef.opacity は ag-psd が 0〜1 スケールで扱う
          l.agPsdRef.opacity = clamped / 100
          return { ...l, opacity: clamped }
        }
        if (l.children.length > 0) {
          const newChildren = updateTree(l.children)
          if (newChildren !== l.children) return { ...l, children: newChildren }
        }
        return l
      })
    set(s => ({ layerTree: updateTree(s.layerTree) }))
  },
})
