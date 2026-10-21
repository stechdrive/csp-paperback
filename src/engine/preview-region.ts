import type { CspLayer } from '../types'
import { materialInfo, resolvedMaterialLayer } from './material-cache'
import { withCanvasResources, type PixelBounds } from './render-resources'
import { copyRenderSources } from './render-sources'
import { copyRenderWarnings } from './render-warning'

export type PreviewRegion = PixelBounds
export interface RegionPreview {
  width: number
  height: number
  /** Called while the original plan's materials are prepared. Coordinates are native pixels. */
  render(region: PreviewRegion): HTMLCanvasElement
}

/** A conservative halo for nested borders and watercolor filters, including virtual insertion. */
const halos = new WeakMap<CspLayer[], number>()
function effectHalo(tree: CspLayer[]): number {
  const cached = halos.get(tree)
  if (cached !== undefined) return cached
  const value = Math.max(0, ...tree.map(layer => {
    const effects = layer.materialEffects, water = effects?.watercolor
    const own = (effects?.edge ? Math.ceil(effects.edge.radius + 2) : 0)
      + (water && !water.style && water.opacity ? Math.ceil(water.range) + Math.ceil(water.blur) + 2 : 0)
    return own + effectHalo(layer.children)
  }))
  halos.set(tree, value)
  return value
}

/** Rebase metadata, borrowing source pixels. Never resize or mutate document canvases. */
function regionTree(tree: CspLayer[], region: PreviewRegion): CspLayer[] {
  return tree.map(original => {
    const material = materialInfo(original.agPsdRef)
    // Unused deferred siblings need no decoding. The selected plan prepares all its dependencies.
    const layer = !material || material.state === 'ready' ? resolvedMaterialLayer(original) : original
    const ref = layer.agPsdRef, mask = ref.mask, effects = layer.materialEffects
    const water = effects?.watercolor
    const fullSize = layer.isFolder || !!(effects?.edge || effects?.layerColor || (water && !water.style && water.range && water.opacity))
    const relative = mask?.positionRelativeToLayer && !fullSize
    return { ...layer, left: layer.left - region.left, top: layer.top - region.top,
      agPsdRef: { ...ref, left: layer.left - region.left, top: layer.top - region.top,
        mask: mask ? { ...mask, positionRelativeToLayer: false,
          left: (mask.left ?? 0) + (relative ? layer.left : 0) - region.left,
          top: (mask.top ?? 0) + (relative ? layer.top : 0) - region.top } : undefined },
      children: regionTree(layer.children, region) }
  })
}

/** The normal compositor runs on a bounded window; effects receive their surrounding pixels. */
export function createRegionPreview(tree: CspLayer[], width: number, height: number,
  render: (tree: CspLayer[], width: number, height: number) => HTMLCanvasElement): RegionPreview {
  const halo = 2 * effectHalo(tree) + 2
  return { width, height, render(region) {
    return withCanvasResources(() => {
      const left = Math.max(0, region.left - halo), top = Math.max(0, region.top - halo)
      const area = { left, top, width: Math.min(width, region.left + region.width + halo) - left,
        height: Math.min(height, region.top + region.height + halo) - top }
      const source = render(regionTree(tree, area), area.width, area.height)
      const canvas = document.createElement('canvas')
      canvas.width = region.width; canvas.height = region.height
      canvas.getContext('2d')!.drawImage(source, left - region.left, top - region.top)
      copyRenderSources(canvas, source); copyRenderWarnings(canvas, source)
      return canvas
    }, () => [])
  } }
}
