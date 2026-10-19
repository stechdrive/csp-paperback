import type { MaterialEffects } from '../types/rendering'
import { copyRenderWarnings } from './render-warning'
import { createRenderCanvas, canvasBounds, setCanvasBounds } from './render-resources'

/** CSP's saved layer-color ramps; alpha is independent of the drawing color. */
export function applyLayerColor(data: Uint8ClampedArray, color: NonNullable<MaterialEffects['layerColor']>): void {
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue
    // Coefficients recovered from native gray/R/G/B ramps and mixed-color pixels.
    const gray = Math.min(255, Math.floor((298912 * data[i] + 586611 * data[i + 1] + 114478 * data[i + 2]) / 1000000))
    for (let c = 0; c < 3; c++) data[i + c] = Math.round((color.main[c] * (255 - gray) + color.sub[c] * gray) / 255)
  }
}

/** Exact squared Euclidean distance transform, linear in the number of pixels. */
function distanceLine(input: Float64Array, output: Float64Array, count: number) {
  const sites = new Int32Array(count), limits = new Float64Array(count + 1)
  let k = 0
  limits[0] = -Infinity; limits[1] = Infinity
  for (let q = 1; q < count; q++) {
    let s = 0
    for (;;) {
      const p = sites[k]
      s = ((input[q] + q * q) - (input[p] + p * p)) / (2 * (q - p))
      if (s > limits[k] || k === 0) break
      k--
    }
    sites[++k] = q; limits[k] = s; limits[k + 1] = Infinity
  }
  k = 0
  for (let q = 0; q < count; q++) {
    while (limits[k + 1] < q) k++
    output[q] = (q - sites[k]) ** 2 + input[sites[k]]
  }
}

/** A bounded, linear-time alpha maximum. The distance field below rounds its support. */
function expandedAlpha(data: Uint8ClampedArray, width: number, height: number, radius: number): Uint8Array {
  const horizontal = new Uint8Array(width * height), result = new Uint8Array(width * height)
  const queue = new Int32Array(Math.max(width, height))
  const pass = (count: number, read: (i: number) => number, write: (i: number, value: number) => void) => {
    let head = 0, tail = 0, next = 0
    for (let i = 0; i < count; i++) {
      while (next < count && next <= i + radius) {
        while (tail > head && read(queue[tail - 1]) <= read(next)) tail--
        queue[tail++] = next++
      }
      while (queue[head] < i - radius) head++
      write(i, read(queue[head]))
    }
  }
  for (let y = 0; y < height; y++) pass(width, x => data[(y * width + x) * 4 + 3], (x, a) => { horizontal[y * width + x] = a })
  for (let x = 0; x < width; x++) pass(height, y => horizontal[y * width + x], (y, a) => { result[y * width + x] = a })
  return result
}

/** Apply effects to the selected material, never to a cached composite of other cels. */
export function applyMaterialEffects(canvas: HTMLCanvasElement, left: number, top: number, effects: MaterialEffects | undefined, width: number, height: number): HTMLCanvasElement {
  if (!effects?.edge && !effects?.layerColor) return canvas
  const result = createRenderCanvas(width, height)
  const ctx = result.getContext('2d')!
  ctx.drawImage(canvas, left, top)
  copyRenderWarnings(result, canvas)
  const area = canvasBounds(canvas, left, top, width, height, effects.edge ? Math.max(0, Math.ceil(effects.edge.radius + 1)) : 0)
  setCanvasBounds(result, area)
  if (!area.width || !area.height) return copyRenderSources(result, canvas)
  const image = ctx.getImageData(area.left, area.top, area.width, area.height), data = image.data
  const wImage = area.width, hImage = area.height
  // Color the artwork before adding the border; the border keeps its own color.
  if (effects.layerColor) applyLayerColor(data, effects.layerColor)
  const edge = effects.edge
  if (edge && edge.radius > 0) {
    const alphaMaximum = edge.reflectOpacity ? expandedAlpha(data, wImage, hImage, Math.ceil(edge.radius)) : undefined
    let x0 = wImage, y0 = hImage, x1 = -1, y1 = -1
    for (let y = 0; y < hImage; y++) for (let x = 0; x < wImage; x++) if (data[(y * wImage + x) * 4 + 3]) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    }
    if (x1 >= x0) {
      const padding = Math.ceil(edge.radius + 1)
      x0 = Math.max(0, x0 - padding); x1 = Math.min(wImage - 1, x1 + padding)
      y0 = Math.max(0, y0 - padding); y1 = Math.min(hImage - 1, y1 + padding)
      const w = x1 - x0 + 1, h = y1 - y0 + 1, distances = new Float64Array(w * h)
      const input = new Float64Array(Math.max(w, h)), output = new Float64Array(input.length)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) input[x] = data[((y + y0) * wImage + x + x0) * 4 + 3] ? 0 : 1e12
        distanceLine(input, output, w)
        distances.set(output.subarray(0, w), y * w)
      }
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) input[y] = distances[y * w + x]
        distanceLine(input, output, h)
        for (let y = 0; y < h; y++) {
          const at = ((y + y0) * wImage + x + x0) * 4, alpha = data[at + 3] / 255
          const distance = Math.sqrt(output[y])
          const stroke = edge.antialias === false ? Number(distance <= edge.radius)
            : Math.max(0, Math.min(1, edge.radius + 0.5 - distance))
          // Reflect opacity expands the alpha envelope; it must not source-over
          // an opaque border underneath every semitransparent interior pixel.
          const combined = alphaMaximum
            ? Math.max(alpha, stroke * alphaMaximum[(y + y0) * wImage + x + x0] / 255)
            : alpha + stroke * (1 - alpha)
          if (!combined) continue
          for (let c = 0; c < 3; c++) data[at + c] = (data[at + c] * alpha + edge.color[c] * (combined - alpha)) / combined
          data[at + 3] = combined * 255
        }
      }
    }
  }
  ctx.putImageData(image, area.left, area.top)
  return copyRenderSources(result, canvas)
}
import { copyRenderSources } from './render-sources'
