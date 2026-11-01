// Native blend arithmetic lives in celcodec; placement and Canvas ownership are application concerns.
import { compositePixel } from 'celcodec/render'
import type { FlatLayer } from '../types'
import { createRenderCanvas, releaseCanvas } from './render-resources'

/** Native modes not represented by Canvas, including CSP glow alpha semantics. */
export function drawNativeBlend(ctx: CanvasRenderingContext2D, layer: FlatLayer): void {
  const left = Math.max(0, Math.floor(layer.left)), top = Math.max(0, Math.floor(layer.top))
  const width = Math.min(ctx.canvas.width, Math.ceil(layer.left + layer.canvas.width)) - left
  const height = Math.min(ctx.canvas.height, Math.ceil(layer.top + layer.canvas.height)) - top
  if (width <= 0 || height <= 0) return
  const surface = createRenderCanvas(width, height)
  try {
    const sctx = surface.getContext('2d')!
    sctx.drawImage(layer.canvas, layer.left - left, layer.top - top)
    const source = sctx.getImageData(0, 0, width, height).data
    const image = ctx.getImageData(left, top, width, height), dest = image.data
    for (let i = 0; i < dest.length; i += 4) {
      if (!source[i + 3]) continue
      dest.set(compositePixel([dest[i], dest[i + 1], dest[i + 2], dest[i + 3]],
        [source[i], source[i + 1], source[i + 2], source[i + 3]],
        layer.nativeBlendMode, layer.opacity / 100), i)
    }
    ctx.putImageData(image, left, top)
  } finally { releaseCanvas(surface) }
}
