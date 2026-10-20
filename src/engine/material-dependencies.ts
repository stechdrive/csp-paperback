import type { CspLayer } from '../types'
import { withCanvasResources } from './render-resources'

// Run the normal selection/context traversal, without rasterizing. This keeps
// virtual-cell overrides, selected cels and excluded process branches identical
// to the actual render instead of reconstructing them from UI hierarchy.
let collecting: Map<string, CspLayer> | undefined

export function collectingMaterials(): boolean { return collecting !== undefined }

export function visitMaterial(layer: CspLayer): void {
  collecting?.set(layer.id, layer)
}

export function collectRenderMaterials(draw: () => unknown): CspLayer[] {
  const previous = collecting
  const found = new Map<string, CspLayer>()
  collecting = found
  try {
    withCanvasResources(draw, () => [])
    return [...found.values()]
  } finally { collecting = previous }
}
