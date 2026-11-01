import type { FlatLayer } from '../types'
import { createRenderCanvas, releaseCanvas } from './render-resources'
import { applyAdjustment } from 'celcodec/render'

/** Adjust the current material stack; never substitute a saved whole-document composite. */
export function drawAdjustment(ctx: CanvasRenderingContext2D, layer: FlatLayer): void {
  const { width, height } = ctx.canvas
  const mask = createRenderCanvas(width, height)
  try {
    const maskCtx = mask.getContext('2d')!
    maskCtx.drawImage(layer.canvas, layer.left, layer.top)
    const coverage = maskCtx.getImageData(0, 0, width, height).data
    const image = ctx.getImageData(0, 0, width, height), data = image.data, adjustment = layer.adjustment!
    // Reuse the coverage buffer's RGB; alpha continues to hold the mask.
    for (let i = 0; i < data.length; i += 4) {
      coverage[i] = data[i]; coverage[i + 1] = data[i + 1]; coverage[i + 2] = data[i + 2]
    }
    applyAdjustment(new Uint8ClampedArray(coverage.buffer, coverage.byteOffset, coverage.length), adjustment)
    for (let i = 0; i < data.length; i += 4) {
      const alpha = coverage[i + 3] / 255 * layer.opacity / 100
      if (!alpha || !data[i + 3]) continue
      for (let c = 0; c < 3; c++) {
        const value = data[i + c]
        const target = coverage[i + c]
        data[i + c] = value + (target - value) * alpha
      }
    }
    ctx.putImageData(image, 0, 0)
  } finally { releaseCanvas(mask) }
}
