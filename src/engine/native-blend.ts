// CSP blend equations and glow alpha semantics: wamsoft/clipparse (MIT).
import type { FlatLayer } from '../types'

const clamp = (v: number) => Math.max(0, Math.min(1, v))
const dodge = (b: number, s: number) => s >= 1 ? 1 : Math.min(1, b / (1 - s))
const burn = (b: number, s: number) => s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s)
const luma = (v: number[]) => v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11

export function nativeBlendChannel(mode: number, b: number, s: number): number {
  switch (mode) {
    case 4: return clamp(b + s - 1)
    case 5: return clamp(b - s)
    case 10: return dodge(b, s)
    case 11: case 12: return clamp(b + s)
    case 17: return s <= 0.5 ? burn(b, 2 * s) : dodge(b, 2 * s - 1)
    case 18: return clamp(b + 2 * s - 1)
    case 19: return s <= 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1)
    case 20: return b + s >= 1 ? 1 : 0
    case 36: return s === 0 ? 1 : clamp(b / s)
    default: return s
  }
}

/** Only used for native modes not represented by Canvas. PSD rendering stays compatible. */
export function drawNativeBlend(ctx: CanvasRenderingContext2D, layer: FlatLayer): void {
  const left = Math.max(0, Math.floor(layer.left)), top = Math.max(0, Math.floor(layer.top))
  const width = Math.min(ctx.canvas.width, Math.ceil(layer.left + layer.canvas.width)) - left
  const height = Math.min(ctx.canvas.height, Math.ceil(layer.top + layer.canvas.height)) - top
  if (width <= 0 || height <= 0) return
  const surface = document.createElement('canvas'); surface.width = width; surface.height = height
  const sctx = surface.getContext('2d')!; sctx.drawImage(layer.canvas, layer.left - left, layer.top - top)
  const source = sctx.getImageData(0, 0, width, height).data, image = ctx.getImageData(left, top, width, height), dest = image.data
  const mode = layer.nativeBlendMode!, opacity = layer.opacity / 100, glow = mode === 10 || mode === 12
  for (let i = 0; i < dest.length; i += 4) {
    const sa = source[i + 3] / 255 * opacity, ba = dest[i + 3] / 255
    if (!sa) continue
    const ao = sa + ba * (1 - sa)
    const b = [dest[i] / 255, dest[i + 1] / 255, dest[i + 2] / 255], s = [source[i] / 255, source[i + 1] / 255, source[i + 2] / 255]
    const compare = mode === 6 || mode === 13 ? (mode === 6 ? luma(s) < luma(b) : luma(s) > luma(b)) : undefined
    for (let c = 0; c < 3; c++) {
      const blended = compare === undefined ? nativeBlendChannel(mode, b[c], s[c] * (glow ? sa : 1)) : compare ? s[c] : b[c]
      const value = (1 - ba) * sa * s[c] + (glow ? ba * blended : ba * sa * blended + (1 - sa) * ba * b[c])
      dest[i + c] = clamp(value / ao) * 255
    }
    dest[i + 3] = ao * 255
  }
  ctx.putImageData(image, left, top)
}
