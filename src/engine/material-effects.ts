import type { MaterialEffects } from '../types/rendering'

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

/** Apply effects to the selected material, never to a cached composite of other cels. */
export function applyMaterialEffects(canvas: HTMLCanvasElement, left: number, top: number, effects: MaterialEffects | undefined, width: number, height: number): HTMLCanvasElement {
  if (!effects?.edge) return canvas
  const result = document.createElement('canvas'); result.width = width; result.height = height
  const ctx = result.getContext('2d')!
  ctx.drawImage(canvas, left, top)
  const image = ctx.getImageData(0, 0, width, height), data = image.data
  const edge = effects.edge
  if (edge && edge.radius > 0) {
    let x0 = width, y0 = height, x1 = -1, y1 = -1
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3]) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    }
    if (x1 >= x0) {
      const padding = Math.ceil(edge.radius + 1)
      x0 = Math.max(0, x0 - padding); x1 = Math.min(width - 1, x1 + padding)
      y0 = Math.max(0, y0 - padding); y1 = Math.min(height - 1, y1 + padding)
      const w = x1 - x0 + 1, h = y1 - y0 + 1, distances = new Float64Array(w * h)
      const input = new Float64Array(Math.max(w, h)), output = new Float64Array(input.length)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) input[x] = data[((y + y0) * width + x + x0) * 4 + 3] ? 0 : 1e12
        distanceLine(input, output, w)
        distances.set(output.subarray(0, w), y * w)
      }
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) input[y] = distances[y * w + x]
        distanceLine(input, output, h)
        for (let y = 0; y < h; y++) {
          const at = ((y + y0) * width + x + x0) * 4, alpha = data[at + 3] / 255
          const stroke = Math.max(0, Math.min(1, edge.radius + 0.5 - Math.sqrt(output[y])))
          const combined = alpha + stroke * (1 - alpha)
          if (!combined) continue
          for (let c = 0; c < 3; c++) data[at + c] = (data[at + c] * alpha + edge.color[c] * stroke * (1 - alpha)) / combined
          data[at + 3] = combined * 255
        }
      }
    }
  }
  ctx.putImageData(image, 0, 0)
  return result
}
