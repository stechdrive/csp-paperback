import type { FlatLayer } from '../types'
import { createRenderCanvas, releaseCanvas } from './render-resources'

/** Adjust the current material stack; never substitute a saved whole-document composite. */
export function drawAdjustment(ctx: CanvasRenderingContext2D, layer: FlatLayer): void {
  const { width, height } = ctx.canvas
  const mask = createRenderCanvas(width, height)
  try {
    const maskCtx = mask.getContext('2d')!
    maskCtx.drawImage(layer.canvas, layer.left, layer.top)
    const coverage = maskCtx.getImageData(0, 0, width, height).data
    const image = ctx.getImageData(0, 0, width, height), data = image.data, adjustment = layer.adjustment!
    for (let i = 0; i < data.length; i += 4) {
      const alpha = coverage[i + 3] / 255 * layer.opacity / 100
      if (!alpha || !data[i + 3]) continue
      for (let c = 0; c < 3; c++) {
        const value = data[i + c]
        const target = adjustment.kind === 'invert' ? 255 - value : value >= adjustment.threshold ? 255 : 0
        data[i + c] = value + (target - value) * alpha
      }
    }
    ctx.putImageData(image, 0, 0)
  } finally { releaseCanvas(mask) }
}
