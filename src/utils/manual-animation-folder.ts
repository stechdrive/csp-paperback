import type { CspLayer } from '../types'

export function findLayerById(layers: CspLayer[], id: string): CspLayer | null {
  for (const layer of layers) {
    if (layer.id === id) return layer
    const found = findLayerById(layer.children, id)
    if (found) return found
  }
  return null
}

function hasEffectiveAnimDescendant(layer: CspLayer, manualAnimFolderIds: Set<string>): boolean {
  for (const child of layer.children) {
    if (child.isAnimationFolder || manualAnimFolderIds.has(child.id)) return true
    if (hasEffectiveAnimDescendant(child, manualAnimFolderIds)) return true
  }
  return false
}

function hasEffectiveAnimAncestor(
  layers: CspLayer[],
  targetId: string,
  manualAnimFolderIds: Set<string>,
  ancestorIsAnim = false,
): boolean {
  for (const layer of layers) {
    if (layer.id === targetId) return ancestorIsAnim
    const nextAncestorIsAnim = ancestorIsAnim || layer.isAnimationFolder || manualAnimFolderIds.has(layer.id)
    if (hasEffectiveAnimAncestor(layer.children, targetId, manualAnimFolderIds, nextAncestorIsAnim)) {
      return true
    }
  }
  return false
}

export function canEnableManualAnimFolder(
  layers: CspLayer[],
  layerId: string,
  manualAnimFolderIds: Set<string>,
): boolean {
  const layer = findLayerById(layers, layerId)
  if (!layer?.isFolder) return false
  if (layer.isAnimationFolder) return false
  if (hasEffectiveAnimAncestor(layers, layerId, manualAnimFolderIds)) return false
  if (hasEffectiveAnimDescendant(layer, manualAnimFolderIds)) return false
  return true
}

export function sanitizeManualAnimFolderIds(
  layers: CspLayer[],
  manualAnimFolderIds: Set<string>,
): Set<string> {
  const sanitized = new Set<string>()
  for (const id of manualAnimFolderIds) {
    if (canEnableManualAnimFolder(layers, id, sanitized)) {
      sanitized.add(id)
    }
  }
  return sanitized
}
