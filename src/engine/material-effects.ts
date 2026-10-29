import type { MaterialEffects } from '../types/rendering'
import { copyRenderWarnings } from './render-warning'
import { copyRenderSources } from './render-sources'
import { createRenderCanvas, canvasBounds, setCanvasBounds } from './render-resources'
import { applyEdge } from './edge-effect'
import { applyWatercolor } from './watercolor-effect'
import { materialEffectCache } from './material-effect-cache'

export function hasDrawableMaterialEffects(effects: MaterialEffects | undefined): boolean {
  const water = effects?.watercolor
  return !!(effects?.layerColor || (effects?.edge && effects.edge.radius > 0) || (water && !water.style && water.range > 0 && water.opacity > 0))
}

/** CSP's saved layer-color ramps; alpha is independent of the drawing color. */
export { applyLayerColor } from 'celcodec/canvas'
import { applyLayerColor } from 'celcodec/canvas'

/** Apply effects to the selected material, never to a cached composite of other cels. */
export function applyMaterialEffects(canvas: HTMLCanvasElement, left: number, top: number, effects: MaterialEffects | undefined, width: number, height: number, immutableSource = false): HTMLCanvasElement {
  const water = effects?.watercolor
  const renderWater = water && !water.style && water.range > 0 && water.opacity > 0
  if (!effects?.edge && !effects?.layerColor && !renderWater) return canvas
  const cached = immutableSource ? materialEffectCache(canvas, [left, top, width, height, effects]) : undefined
  const hit = cached?.cache.getEffect(cached.key)
  if (hit) return hit
  const result = createRenderCanvas(width, height)
  const ctx = result.getContext('2d')!
  ctx.drawImage(canvas, left, top)
  copyRenderWarnings(result, canvas)
  const padding = (effects?.edge ? Math.max(0, Math.ceil(effects.edge.radius + 1.5)) : 0) + (renderWater ? Math.ceil(water.blur) : 0)
  const area = canvasBounds(canvas, left, top, width, height, padding)
  setCanvasBounds(result, area)
  if (area.width && area.height) {
    const image = ctx.getImageData(area.left, area.top, area.width, area.height)
  // Color the artwork before adding the border; the border keeps its own color.
    if (effects?.layerColor) applyLayerColor(image.data, effects.layerColor)
    if (renderWater) applyWatercolor(image.data, area.width, area.height, water)
    if (effects?.edge) applyEdge(image.data, area.width, area.height, effects.edge)
    ctx.putImageData(image, area.left, area.top)
  }
  copyRenderSources(result, canvas)
  cached?.cache.setEffect(cached.key, result)
  return result
}
