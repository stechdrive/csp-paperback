/** Only canvases allocated inside this synchronous render may be released. */
import { ImageResourceError } from '../utils/image-budget'

let allocations: Set<HTMLCanvasElement> | undefined
const trackedBytes = new WeakMap<HTMLCanvasElement, number>()
let activeBytes = 0
const MAX_RENDER_BYTES = 512 * 1024 * 1024

function untrack(canvas: HTMLCanvasElement) {
  activeBytes -= trackedBytes.get(canvas) ?? 0
  trackedBytes.delete(canvas)
}

export function createRenderCanvas(width: number, height: number): HTMLCanvasElement {
  const bytes = width * height * 4
  if (allocations && activeBytes + bytes > MAX_RENDER_BYTES) {
    throw new ImageResourceError('この画像の合成用メモリが上限を超えました。表示する素材を減らして再試行してください。出力は中止しました。')
  }
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  allocations?.add(canvas)
  if (allocations) { trackedBytes.set(canvas, bytes); activeBytes += bytes }
  return canvas
}

export function releaseCanvas(canvas: HTMLCanvasElement): void {
  untrack(canvas)
  canvas.width = 1; canvas.height = 1
}

/** Transfer a newly allocated canvas to an explicit cache owner. */
export function detachCanvasResource(canvas: HTMLCanvasElement): void { allocations?.delete(canvas); untrack(canvas) }

export function withCanvasResources<T>(render: () => T,
  retain: (result: T, owned: ReadonlySet<HTMLCanvasElement>) => Iterable<HTMLCanvasElement>): T {
  const parent = allocations, owned = new Set<HTMLCanvasElement>()
  allocations = owned
  let kept = new Set<HTMLCanvasElement>()
  try {
    const result = render()
    kept = new Set(retain(result, owned))
    return result
  } finally {
    allocations = parent
    for (const canvas of owned) {
      if (kept.has(canvas)) {
        if (parent) parent.add(canvas)
        else untrack(canvas)
      }
      else releaseCanvas(canvas)
    }
  }
}

export interface PixelBounds { left: number; top: number; width: number; height: number }
const bounds = new WeakMap<HTMLCanvasElement, PixelBounds>()
export function setCanvasBounds(canvas: HTMLCanvasElement, value: PixelBounds): void { bounds.set(canvas, value) }

/** Conservative integer bounds, including interpolation at fractional positions. */
export function canvasBounds(canvas: HTMLCanvasElement, left: number, top: number, width: number, height: number, padding = 0): PixelBounds {
  const area = bounds.get(canvas) ?? { left: 0, top: 0, width: canvas.width, height: canvas.height }
  if (!area.width || !area.height) return { left: 0, top: 0, width: 0, height: 0 }
  const x0 = Math.max(0, Math.floor(left + area.left) - padding)
  const y0 = Math.max(0, Math.floor(top + area.top) - padding)
  const x1 = Math.min(width, Math.ceil(left + area.left + area.width) + padding)
  const y1 = Math.min(height, Math.ceil(top + area.top + area.height) + padding)
  return { left: x0, top: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) }
}

export function unionBounds(areas: PixelBounds[]): PixelBounds {
  const nonempty = areas.filter(a => a.width && a.height)
  if (!nonempty.length) return { left: 0, top: 0, width: 0, height: 0 }
  const left = Math.min(...nonempty.map(a => a.left)), top = Math.min(...nonempty.map(a => a.top))
  return { left, top, width: Math.max(...nonempty.map(a => a.left + a.width)) - left,
    height: Math.max(...nonempty.map(a => a.top + a.height)) - top }
}
