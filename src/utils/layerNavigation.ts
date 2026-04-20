import type { CspLayer, VirtualSet } from '../types'

export interface FlatEntry {
  id: string
  layer: CspLayer
  kind: 'layer' | 'virtualSet'
  virtualSet?: VirtualSet
  isCell: boolean
  animParentId: string | undefined
}

/** 展開状態を考慮して表示中のレイヤーをフラットリスト化 */
export function flattenVisible(
  layers: CspLayer[],
  expandedFolders: Set<string>,
  manualAnimFolderIds: Set<string>,
  virtualSets: VirtualSet[] = [],
  parentAnimId?: string,
): FlatEntry[] {
  const result: FlatEntry[] = []
  for (const layer of layers) {
    const isAnimFolder = layer.isAnimationFolder || (layer.isFolder && manualAnimFolderIds.has(layer.id))
    for (const vs of virtualSets) {
      if (vs.insertionLayerId !== layer.id || vs.insertionPosition !== 'above') continue
      result.push({
        id: vs.id,
        layer,
        kind: 'virtualSet',
        virtualSet: vs,
        isCell: false,
        animParentId: undefined,
      })
    }
    result.push({
      id: layer.id,
      layer,
      kind: 'layer',
      isCell: !!parentAnimId,
      animParentId: parentAnimId,
    })
    for (const vs of virtualSets) {
      if (vs.insertionLayerId !== layer.id || vs.insertionPosition !== 'below') continue
      result.push({
        id: vs.id,
        layer,
        kind: 'virtualSet',
        virtualSet: vs,
        isCell: false,
        animParentId: undefined,
      })
    }
    if (layer.isFolder && expandedFolders.has(layer.id) && layer.children.length > 0) {
      result.push(...flattenVisible(
        layer.children,
        expandedFolders,
        manualAnimFolderIds,
        virtualSets,
        isAnimFolder ? layer.id : parentAnimId,
      ))
    }
  }
  return result
}

function isEffectiveAnimationFolder(layer: CspLayer, manualAnimFolderIds: Set<string>): boolean {
  return layer.isAnimationFolder || (layer.isFolder && manualAnimFolderIds.has(layer.id))
}

/**
 * Shift+スクロール時だけ自動展開してよいフォルダIDを返す。
 * ユーザーの開閉状態は変えず、アニメフォルダ・単体出力マークとその祖先だけを
 * ナビゲーション候補として一時的に開くために使う。
 */
export function collectShiftNavigationExpandableFolders(
  layers: CspLayer[],
  manualAnimFolderIds: Set<string>,
  virtualSets: VirtualSet[] = [],
): Set<string> {
  const result = new Set<string>()
  const virtualSetInsertionIds = new Set(
    virtualSets
      .map(vs => vs.insertionLayerId)
      .filter((id): id is string => id !== null),
  )

  function walk(layer: CspLayer): boolean {
    let subtreeHasTarget =
      isEffectiveAnimationFolder(layer, manualAnimFolderIds) ||
      layer.autoMarked ||
      layer.singleMark ||
      virtualSetInsertionIds.has(layer.id)
    for (const child of layer.children) {
      if (walk(child)) {
        subtreeHasTarget = true
      }
    }
    if (layer.isFolder && subtreeHasTarget) {
      result.add(layer.id)
    }

    return subtreeHasTarget
  }

  for (const layer of layers) {
    walk(layer)
  }

  return result
}

export function mergeExpandedFolders(
  expandedFolders: Set<string>,
  extraExpandedFolders: Set<string>,
): Set<string> {
  if (extraExpandedFolders.size === 0) return expandedFolders

  const result = new Set(expandedFolders)
  for (const id of extraExpandedFolders) {
    result.add(id)
  }
  return result
}

/**
 * 明示的に閉じられたフォルダ集合を除外した展開集合を返す。
 * Shift+スクロール巡回の仮展開がユーザーの「閉じる」意志を上書きしないようにする。
 */
export function subtractCollapsedFolders(
  expandedFolders: Set<string>,
  userCollapsedFolders: Set<string>,
): Set<string> {
  if (userCollapsedFolders.size === 0) return expandedFolders

  const result = new Set<string>()
  for (const id of expandedFolders) {
    if (!userCollapsedFolders.has(id)) result.add(id)
  }
  return result
}

/**
 * 選択中のレイヤーを表示するために必要な一時展開フォルダだけを返す。
 * もともとユーザーが開いていたフォルダは含めないので、選択が外に出たら自然に閉じる。
 */
export function collectShiftNavigationExpandedPath(
  layers: CspLayer[],
  targetLayerId: string,
  userExpandedFolders: Set<string>,
  shiftExpandableFolders: Set<string>,
): Set<string> {
  const path: CspLayer[] = []

  function find(currentLayers: CspLayer[]): boolean {
    for (const layer of currentLayers) {
      path.push(layer)
      if (layer.id === targetLayerId) return true
      if (find(layer.children)) return true
      path.pop()
    }
    return false
  }

  if (!find(layers)) return new Set()

  const result = new Set<string>()
  for (const layer of path) {
    if (
      layer.isFolder &&
      shiftExpandableFolders.has(layer.id) &&
      !userExpandedFolders.has(layer.id)
    ) {
      result.add(layer.id)
    }
  }

  return result
}

export function findLayerById(layers: CspLayer[], id: string): CspLayer | null {
  for (const l of layers) {
    if (l.id === id) return l
    const found = findLayerById(l.children, id)
    if (found) return found
  }
  return null
}
