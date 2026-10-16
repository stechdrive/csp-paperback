import type { AnimationFolderInfo, CspLayer } from '../types'
import type { SingleMark } from '../types/marks'
import type { ProcessFolderEntry } from '../types/project'
import { promoteAutoMarkedByProcessMatch } from '../engine/tree-builder'
import { isAutoMarkedOutputTarget } from '../utils/auto-marked-container'
import { normalizeProcessFolderName } from '../utils/process-folder'
import type { AppStore } from './index'
import { collectOutputNavigation, type OutputNavigation } from '../utils/output-navigation'
import { buildOutputPlan, type OutputFile } from '../utils/output-plan'
import { isOutputTargetExcluded } from '../utils/output-target'
import { buildDraftOutputs } from '../utils/draft-output'

let draftCache: { inputs: unknown[]; result: OutputFile[] } | undefined
export function selectDraftOutputs(state: AppStore): OutputFile[] {
  const tree = selectLayerTreeWithVisibility(state)
  const inputs = [tree, state.virtualSets, state.docWidth, state.docHeight, state.outputConfig, state.projectSettings]
  if (draftCache && inputs.every((v, i) => v === draftCache!.inputs[i])) return draftCache.result
  const result = buildDraftOutputs(tree, state)
  draftCache = { inputs, result }
  return result
}

let outputPlanCache: {
  inputs: readonly unknown[]
  result: OutputFile[]
} | null = null

/** Selection, frame seeking and folder expansion never rebuild the file manifest. */
export function selectOutputFiles(state: AppStore): OutputFile[] {
  const tree = selectLayerTreeWithVisibility(state)
  const inputs = [tree, state.projectSettings, state.outputConfig, state.virtualSets,
    state.timelineData, state.docWidth, state.docHeight]
  if (outputPlanCache && inputs.every((value, index) => value === outputPlanCache!.inputs[index])) {
    return outputPlanCache.result
  }
  const result = buildOutputPlan(tree, state)
  outputPlanCache = { inputs, result }
  return result
}

let outputNavigationCache: {
  tree: CspLayer[]
  projectSettings: AppStore['projectSettings']
  outputConfig: AppStore['outputConfig']
  virtualSets: AppStore['virtualSets']
  result: OutputNavigation
} | null = null

let candidateCache: { tree: CspLayer[]; settings: AppStore['projectSettings']; virtualSets: AppStore['virtualSets']; result: OutputNavigation['entries'] } | null = null

/** Keep detected choices present when an eye or output checkbox is turned off. */
export function selectOutputCandidates(state: AppStore): OutputNavigation['entries'] {
  const tree = selectLayerTreeWithVisibility(state)
  if (candidateCache?.tree === tree && candidateCache.settings === state.projectSettings && candidateCache.virtualSets === state.virtualSets) return candidateCache.result
  const result = collectOutputNavigation(tree, state.projectSettings, state.outputConfig, state.virtualSets,
    { includeHidden: true, includeExcluded: true }).entries
  candidateCache = { tree, settings: state.projectSettings, virtualSets: state.virtualSets, result }
  return result
}

export interface OutputRowStatus { total: number; excluded: number }
let statusCache: { candidates: OutputNavigation['entries']; config: AppStore['outputConfig']; result: Map<string, OutputRowStatus> } | null = null

export function selectOutputRowStatuses(state: AppStore): Map<string, OutputRowStatus> {
  const candidates = selectOutputCandidates(state)
  if (statusCache?.candidates === candidates && statusCache.config === state.outputConfig) return statusCache.result
  const result = new Map<string, OutputRowStatus>()
  for (const entry of candidates) {
    const excluded = isOutputTargetExcluded(entry.outputTarget, state.outputConfig)
    for (const id of new Set([entry.id, ...entry.ancestorIds, ...entry.memberIds])) {
      const status = result.get(id) ?? { total: 0, excluded: 0 }
      status.total++
      if (excluded) status.excluded++
      result.set(id, status)
    }
  }
  statusCache = { candidates, config: state.outputConfig, result }
  return result
}

/** Shared by event handlers and views, so rapid events always use current outputs. */
export function selectOutputNavigation(state: AppStore): OutputNavigation {
  const tree = selectLayerTreeWithVisibility(state)
  const { projectSettings, outputConfig, virtualSets } = state
  if (outputNavigationCache?.tree === tree && outputNavigationCache.projectSettings === projectSettings &&
    outputNavigationCache.outputConfig === outputConfig && outputNavigationCache.virtualSets === virtualSets) {
    return outputNavigationCache.result
  }
  const result = collectOutputNavigation(tree, projectSettings, outputConfig, virtualSets)
  outputNavigationCache = { tree, projectSettings, outputConfig, virtualSets, result }
  return result
}

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
  processFolderKey: string
  result: CspLayer[]
} | null = null

let _navigatorCache: {
  layerTree: CspLayer[]
  visibilityOverrides: Map<string, boolean>
  timelineData: AppStore['timelineData']
  processFolderKey: string
  result: CspLayer[]
} | null = null

const emptyManualAnimFolderIds = new Set<string>()
const emptySingleMarks = new Map<string, SingleMark>()

const processFolderKeys = new WeakMap<ProcessFolderEntry[], string>()
function processFolderKey(table: ProcessFolderEntry[]): string {
  let key = processFolderKeys.get(table)
  if (key === undefined) {
    // Auto-promotion only depends on folder matching, not labels or border colors.
    key = JSON.stringify([...new Set(table.flatMap(entry => entry.folderNames.map(normalizeProcessFolderName)))].sort())
    processFolderKeys.set(table, key)
  }
  return key
}

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
  const folderKey = processFolderKey(processTable)

  // 入力参照がすべて前回と同じなら前回の結果を返す（無限ループ防止）
  if (
    _cache !== null &&
    _cache.layerTree === layerTree &&
    _cache.visibilityOverrides === visibilityOverrides &&
    _cache.manualAnimFolderIds === manualAnimFolderIds &&
    _cache.singleMarks === singleMarks &&
    _cache.processFolderKey === folderKey
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

  _cache = { layerTree, visibilityOverrides, manualAnimFolderIds, singleMarks, processFolderKey: folderKey, result }
  return result
}

/**
 * 全体ナビゲーター用のツリー。
 * XDTS 読み込み中は「CSP のタイムライン表示」を再現するため、
 * アプリ独自の手動アニメーションフォルダ指定は反映しない。
 * XDTS がない場合は従来どおり手動指定も含めたツリーを返す。
 */
export function selectLayerTreeForNavigator(state: AppStore): CspLayer[] {
  if (!state.timelineData) {
    return selectLayerTreeWithVisibility(state)
  }

  const { layerTree, visibilityOverrides, timelineData } = state
  const processTable = state.projectSettings?.processTable ?? []
  const folderKey = processFolderKey(processTable)
  if (
    _navigatorCache !== null &&
    _navigatorCache.layerTree === layerTree &&
    _navigatorCache.visibilityOverrides === visibilityOverrides &&
    _navigatorCache.timelineData === timelineData &&
    _navigatorCache.processFolderKey === folderKey
  ) {
    return _navigatorCache.result
  }

  const overridden = visibilityOverrides.size > 0
    ? applyOverrides(layerTree, visibilityOverrides, emptyManualAnimFolderIds, emptySingleMarks)
    : layerTree
  const result = promoteAutoMarkedByProcessMatch(overridden, processTable)

  _navigatorCache = { layerTree, visibilityOverrides, timelineData, processFolderKey: folderKey, result }
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
  const layerTree = selectLayerTreeWithVisibility(state)

  // _プレフィックス自動マーク
  function walkAutoMarked(layers: CspLayer[]): void {
    for (const layer of layers) {
      const isAnimFolder = layer.isAnimationFolder || (layer.isFolder && manualAnimFolderIds.has(layer.id))
      if (isAutoMarkedOutputTarget(layer) && !isAnimFolder) ids.add(layer.id)
      if (!isAnimFolder) walkAutoMarked(layer.children)
    }
  }
  walkAutoMarked(layerTree)

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
      const normalized = normalizeProcessFolderName(name)
      if (!normalized) continue
      if (seen.has(normalized)) {
        duplicates.add(name)
      } else {
        seen.set(normalized, entry.suffix)
      }
    }
  }

  return duplicates
}
