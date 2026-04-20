import type { AnimationFolderInfo, CspLayer } from '../types'
import type { SingleMark } from '../types/marks'
import type { ProcessFolderEntry } from '../types/project'
import { promoteAutoMarkedByProcessMatch } from '../engine/tree-builder'
import type { AppStore } from './index'

/**
 * selectLayerTreeWithVisibility のメモ化キャッシュ。
 * Zustand は同じストア状態でセレクターを複数回呼ぶことがあり、
 * 毎回新しい参照を返すと無限ループになる。
 * 入力参照がすべて同じであれば前回の結果をそのまま返す（1-entry cache）。
 */
let _cache: {
  layerTree: CspLayer[]
  visibilityOverrides: Map<string, boolean>
  manualAnimFolderIds: Set<string>
  singleMarks: Map<string, SingleMark>
  processTable: ProcessFolderEntry[]
  result: CspLayer[]
} | null = null

let _navigatorCache: {
  layerTree: CspLayer[]
  visibilityOverrides: Map<string, boolean>
  xdtsData: AppStore['xdtsData']
  processTable: ProcessFolderEntry[]
  result: CspLayer[]
} | null = null

const emptyManualAnimFolderIds = new Set<string>()
const emptySingleMarks = new Map<string, SingleMark>()

/**
 * visibilityOverrides と manualAnimFolderIds を反映したツリーを返す。
 * 元のツリーは変更せず新しいオブジェクトを返す。
 * manualAnimFolderIds に含まれるフォルダは isAnimationFolder=true + animationFolder 付きとして扱い、
 * flatten/export パイプラインまで正しく伝播する。
 */
export function selectLayerTreeWithVisibility(state: AppStore): CspLayer[] {
  const { layerTree, visibilityOverrides, manualAnimFolderIds, singleMarks } = state
  // projectSettings が欠けた部分モック state も許容する（既存テストとの後方互換）。
  const processTable = state.projectSettings?.processTable ?? []

  // 入力参照がすべて前回と同じなら前回の結果を返す（無限ループ防止）
  if (
    _cache !== null &&
    _cache.layerTree === layerTree &&
    _cache.visibilityOverrides === visibilityOverrides &&
    _cache.manualAnimFolderIds === manualAnimFolderIds &&
    _cache.singleMarks === singleMarks &&
    _cache.processTable === processTable
  ) {
    return _cache.result
  }

  const hasOverrides = visibilityOverrides.size > 0 || manualAnimFolderIds.size > 0 || singleMarks.size > 0
  const overridden = hasOverrides
    ? applyOverrides(layerTree, visibilityOverrides, manualAnimFolderIds, singleMarks)
    : layerTree
  // XDTS/手動マーク反映後に autoMarked の工程一致昇格を適用する。
  // 既に isAnimationFolder=true のフォルダは昇格対象外なので順序は影響しない。
  const result = promoteAutoMarkedByProcessMatch(overridden, processTable)

  _cache = { layerTree, visibilityOverrides, manualAnimFolderIds, singleMarks, processTable, result }
  return result
}

/**
 * 全体ナビゲーター用のツリー。
 * XDTS 読み込み中は「CSP のタイムライン表示」を再現するため、
 * アプリ独自の手動アニメーションフォルダ指定は反映しない。
 * XDTS がない場合は従来どおり手動指定も含めたツリーを返す。
 */
export function selectLayerTreeForNavigator(state: AppStore): CspLayer[] {
  if (!state.xdtsData) {
    return selectLayerTreeWithVisibility(state)
  }

  const { layerTree, visibilityOverrides, xdtsData } = state
  const processTable = state.projectSettings?.processTable ?? []
  if (
    _navigatorCache !== null &&
    _navigatorCache.layerTree === layerTree &&
    _navigatorCache.visibilityOverrides === visibilityOverrides &&
    _navigatorCache.xdtsData === xdtsData &&
    _navigatorCache.processTable === processTable
  ) {
    return _navigatorCache.result
  }

  const overridden = visibilityOverrides.size > 0
    ? applyOverrides(layerTree, visibilityOverrides, emptyManualAnimFolderIds, emptySingleMarks)
    : layerTree
  const result = promoteAutoMarkedByProcessMatch(overridden, processTable)

  _navigatorCache = { layerTree, visibilityOverrides, xdtsData, processTable, result }
  return result
}

function applyOverrides(
  layers: CspLayer[],
  visOverrides: Map<string, boolean>,
  manualAnimIds: Set<string>,
  singleMarks: Map<string, SingleMark>,
): CspLayer[] {
  let changed = false
  const result = layers.map(layer => {
    const hasOverride = visOverrides.has(layer.id)
    // override が存在する場合: その値を uiHidden として使い、PSD の hidden フラグをクリアする。
    // これにより PSD 上で非表示だったレイヤーを UI 上で表示可能にする。
    const uiHidden = hasOverride ? visOverrides.get(layer.id)! : layer.uiHidden
    const hidden = hasOverride ? false : layer.hidden
    const isAnimationFolder = layer.isAnimationFolder || (layer.isFolder && manualAnimIds.has(layer.id))
    const singleMark = singleMarks.has(layer.id)

    // 手動指定フォルダ（animationFolder=null）→ animationFolder オブジェクトを生成
    let animationFolder: AnimationFolderInfo | null = layer.animationFolder
    if (isAnimationFolder && animationFolder === null) {
      animationFolder = { detectedBy: 'manual', trackName: layer.originalName }
    }

    const children = layer.children.length > 0
      ? applyOverrides(layer.children, visOverrides, manualAnimIds, singleMarks)
      : layer.children

    if (
      uiHidden === layer.uiHidden &&
      hidden === layer.hidden &&
      isAnimationFolder === layer.isAnimationFolder &&
      animationFolder === layer.animationFolder &&
      singleMark === layer.singleMark &&
      children === layer.children
    ) {
      return layer
    }
    changed = true
    return { ...layer, uiHidden, hidden, isAnimationFolder, animationFolder, singleMark, children }
  })
  return changed ? result : layers
}

/**
 * アニメーションフォルダ（xdts検出 + 手動指定）の一覧を返す
 */
export function selectAnimationFolders(state: AppStore): CspLayer[] {
  const layerTree = selectLayerTreeWithVisibility(state)
  const result: CspLayer[] = []

  function walk(layers: CspLayer[]): void {
    for (const layer of layers) {
      if (layer.isAnimationFolder) {
        result.push(layer)
      }
      walk(layer.children)
    }
  }

  walk(layerTree)
  return result
}

/**
 * 指定IDのレイヤーをツリーから検索して返す
 */
export function selectLayerById(state: AppStore, id: string): CspLayer | null {
  function walk(layers: CspLayer[]): CspLayer | null {
    for (const layer of layers) {
      if (layer.id === id) return layer
      const found = walk(layer.children)
      if (found) return found
    }
    return null
  }
  return walk(state.layerTree)
}

/**
 * 現在選択されているレイヤーを返す
 */
export function selectSelectedLayer(state: AppStore): CspLayer | null {
  if (!state.selectedLayerId) return null
  return selectLayerById(state, state.selectedLayerId)
}

/**
 * 出力対象エントリのファイル名一覧（プレビュー用）
 * scope: 'all' = 全レイヤー, 'marked' = マーク済みのみ
 */
export function selectMarkedLayerIds(state: AppStore): Set<string> {
  const ids = new Set<string>()
  const { manualAnimFolderIds } = state

  // _プレフィックス自動マーク
  function walkAutoMarked(layers: CspLayer[]): void {
    for (const layer of layers) {
      const isAnimFolder = layer.isAnimationFolder || (layer.isFolder && manualAnimFolderIds.has(layer.id))
      if (layer.autoMarked && !isAnimFolder) ids.add(layer.id)
      if (!isAnimFolder) walkAutoMarked(layer.children)
    }
  }
  walkAutoMarked(state.layerTree)

  // シングルマーク（手動）
  for (const [id] of state.singleMarks) {
    if (manualAnimFolderIds.has(id)) continue
    ids.add(id)
  }

  return ids
}

/**
 * processTableに同一フォルダ名が複数サフィックスに登録されていないか検証
 * 重複があればフォルダ名のSetを返す
 */
export function selectProcessTableErrors(state: AppStore): Set<string> {
  const { processTable } = state.projectSettings
  const seen = new Map<string, string>() // folderName → suffix
  const duplicates = new Set<string>()

  for (const entry of processTable) {
    for (const name of entry.folderNames) {
      const lower = name.toLowerCase()
      if (seen.has(lower)) {
        duplicates.add(name)
      } else {
        seen.set(lower, entry.suffix)
      }
    }
  }

  return duplicates
}
