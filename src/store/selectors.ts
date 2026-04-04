import type { CspLayer } from '../types'
import type { AppStore } from './index'

/**
 * visibilityOverridesを反映した表示中レイヤーのみのツリーを返す
 * 元のツリーは変更せず、uiHiddenを上書きした新しいツリーを返す
 */
export function selectLayerTreeWithVisibility(state: AppStore): CspLayer[] {
  const { layerTree, visibilityOverrides } = state
  if (visibilityOverrides.size === 0) return layerTree
  return applyVisibilityOverrides(layerTree, visibilityOverrides)
}

function applyVisibilityOverrides(
  layers: CspLayer[],
  overrides: Map<string, boolean>
): CspLayer[] {
  return layers.map(layer => {
    const uiHidden = overrides.get(layer.id) ?? layer.uiHidden
    const children = layer.children.length > 0
      ? applyVisibilityOverrides(layer.children, overrides)
      : layer.children
    return { ...layer, uiHidden, children }
  })
}

/**
 * アニメーションフォルダ（xdts検出 + 手動指定）の一覧を返す
 */
export function selectAnimationFolders(state: AppStore): CspLayer[] {
  const { layerTree, manualAnimFolderIds } = state
  const result: CspLayer[] = []

  function walk(layers: CspLayer[]): void {
    for (const layer of layers) {
      if (layer.isAnimationFolder || manualAnimFolderIds.has(layer.id)) {
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

  // _プレフィックス自動マーク
  function walkAutoMarked(layers: CspLayer[]): void {
    for (const layer of layers) {
      if (layer.autoMarked) ids.add(layer.id)
      walkAutoMarked(layer.children)
    }
  }
  walkAutoMarked(state.layerTree)

  // シングルマーク（手動）
  for (const [id] of state.singleMarks) {
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

/**
 * 選択されたアニメーションフォルダのモードを返す（ストアの設定 > レイヤーのデフォルト）
 */
export function selectFolderMode(state: AppStore, layerId: string) {
  return state.folderModes.get(layerId) ?? state.projectSettings.defaultMode
}
