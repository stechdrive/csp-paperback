import type { CspLayer } from '../types'

export interface FlatEntry {
  id: string
  layer: CspLayer
  isCell: boolean
  animParentId: string | undefined
}

/** 展開状態を考慮して表示中のレイヤーをフラットリスト化 */
export function flattenVisible(
  layers: CspLayer[],
  expandedFolders: Set<string>,
  manualAnimFolderIds: Set<string>,
  parentAnimId?: string,
): FlatEntry[] {
  const result: FlatEntry[] = []
  for (const layer of layers) {
    const isAnimFolder = layer.isAnimationFolder || (layer.isFolder && manualAnimFolderIds.has(layer.id))
    result.push({
      id: layer.id,
      layer,
      isCell: !!parentAnimId,
      animParentId: parentAnimId,
    })
    if (layer.isFolder && expandedFolders.has(layer.id) && layer.children.length > 0) {
      result.push(...flattenVisible(
        layer.children,
        expandedFolders,
        manualAnimFolderIds,
        isAnimFolder ? layer.id : parentAnimId,
      ))
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
