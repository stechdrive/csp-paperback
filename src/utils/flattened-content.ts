import type { CspLayer } from '../types'
import { resolveSelectedAnimCell } from './anim-cell-selection'

/**
 * Whether default flattening emits any FlatLayer, without drawing.
 * Opacity and masks can make an image transparent, but do not remove its output.
 * Virtual-cell overrides use visible=true and do not clear PSD's hidden flag.
 */
export function hasDefaultFlattenedContent(
  layers: CspLayer[],
  visibilityOverrides: Record<string, boolean> = {},
): boolean {
  function withVisibility(layer: CspLayer): CspLayer {
    const visible = visibilityOverrides[layer.id]
    return visible === undefined || layer.uiHidden === !visible
      ? layer
      : { ...layer, uiHidden: !visible }
  }

  function hasContent(sourceLayer: CspLayer): boolean {
    const layer = withVisibility(sourceLayer)
    if (layer.hidden || layer.uiHidden) return false
    if (layer.isAnimationFolder) {
      const selection = resolveSelectedAnimCell({ ...layer, children: layer.children.map(withVisibility) }, undefined)
      return selection !== null && hasContent(selection.cell)
    }
    if (layer.isFolder) return layer.children.some(hasContent)
    return !!(layer.agPsdRef.canvas || layer.vectorRendering || layer.unsupported3D)
  }

  return layers.some(hasContent)
}
