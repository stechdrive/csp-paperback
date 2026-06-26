import type { CspLayer, VirtualSet } from '../types'

export type VirtualSetInsertionPosition = VirtualSet['insertionPosition']

export interface VirtualSetInsertionTarget {
  insertionLayerId: string
  insertionPosition: VirtualSetInsertionPosition
}

interface SiblingContext {
  layer: CspLayer
  siblings: CspLayer[]
  index: number
}

function findSiblingContext(layers: CspLayer[], layerId: string): SiblingContext | null {
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]
    if (layer.id === layerId) return { layer, siblings: layers, index: i }
    const found = findSiblingContext(layer.children, layerId)
    if (found) return found
  }
  return null
}

/**
 * 行の下半分へのドロップを、同じ隙間を表す次の兄弟の "above" に正規化する。
 * これにより展開中フォルダの直下へ落としたときも、フォルダ配下ではなく
 * フォルダ同士の間として安定して保存・表示できる。
 */
export function resolveVirtualSetInsertionTarget(
  tree: CspLayer[],
  layerId: string,
  position: VirtualSetInsertionPosition,
): VirtualSetInsertionTarget {
  const context = findSiblingContext(tree, layerId)
  if (!context) {
    return { insertionLayerId: layerId, insertionPosition: position }
  }

  if (position === 'below') {
    const nextSibling = context.siblings[context.index + 1]
    if (nextSibling) {
      return { insertionLayerId: nextSibling.id, insertionPosition: 'above' }
    }
  }

  return { insertionLayerId: layerId, insertionPosition: position }
}

export function resolveVirtualSetFolderChildInsertionTarget(
  tree: CspLayer[],
  folderId: string,
): VirtualSetInsertionTarget | null {
  const context = findSiblingContext(tree, folderId)
  const firstChild = context?.layer.children[0]
  if (!context?.layer.isFolder || !firstChild) return null
  return { insertionLayerId: firstChild.id, insertionPosition: 'above' }
}
