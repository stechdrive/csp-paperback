import type { OutputFile } from './output-plan'
import type { BoardSize } from './preview-grid'
import type { BoardSprite } from './output-board-renderer'
import type { PreviewRegion } from '../engine/preview-region'
import { outputDetailQueue as queue } from './output-render-queue'
import { renderOutputRegion } from './output-region-render'
import type { ProjectSettings } from '../types'
import type { ClipDiagnostic } from './clip/types'

type Rect = PreviewRegion
type Request = { file: OutputFile; release: () => void; unsubscribe: () => void }
const tileEdge = 512

/** Shared native windows, independent of a board/single view and its selection or filename. */
export class OutputDetail {
  private requests = new Map<string, Request>()
  private wanted = new Set<string>()
  pending = false
  error: string | undefined
  private invalidate: () => void
  private table: ProjectSettings['processTable']
  private border: boolean
  private diagnostics: ClipDiagnostic[]
  constructor(invalidate: () => void, table: ProjectSettings['processTable'], border: boolean, diagnostics: ClipDiagnostic[]) {
    this.invalidate = invalidate; this.table = table; this.border = border; this.diagnostics = diagnostics
  }
  begin() { this.wanted.clear(); this.pending = false; this.error = undefined }
  sprites(file: OutputFile, rect: Rect, viewport: BoardSize, ratio: number, overview?: HTMLCanvasElement): BoardSprite[] {
    const native = file.preview
    const base = { key: file.renderKey, image: overview, x: rect.left, y: rect.top, width: rect.width, height: rect.height }
    if (!native) return [base]
    const zoom = rect.width / native.width, physical = zoom * ratio
    const nativeOverview = overview?.width === native.width && overview.height === native.height
    if (nativeOverview || Math.max(rect.width, rect.height) * ratio <= Math.min(1024, Math.max(native.width, native.height))) {
      return [{ ...base, nearest: nativeOverview && physical >= 1 - 1e-6 }]
    }
    // Use full native samples at/above 100%; below that keep at least one sample per screen pixel.
    const level = Math.max(0, Math.floor(Math.log2(1 / physical))), scale = 2 ** -level, step = tileEdge / scale
    const x0 = Math.max(0, Math.floor(-rect.left / zoom / step)), y0 = Math.max(0, Math.floor(-rect.top / zoom / step))
    const x1 = Math.min(Math.ceil(native.width / step), Math.ceil((viewport.width - rect.left) / zoom / step))
    const y1 = Math.min(Math.ceil(native.height / step), Math.ceil((viewport.height - rect.top) / zoom / step))
    const sprites: BoardSprite[] = []
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const region = { left: x * step, top: y * step, width: Math.min(step, native.width - x * step), height: Math.min(step, native.height - y * step) }
      const key = `${file.renderKey}:region:${level}:${x}:${y}`
      const tile = { ...file, renderKey: key }
      this.wanted.add(key)
      if (!this.requests.has(key)) {
        const unsubscribe = queue.subscribe([tile], 'full', this.invalidate)
        const release = queue.request(tile, 'full', (_cache, cancelled) => renderOutputRegion(file, region, scale, this.table, this.border, this.diagnostics, cancelled))
        this.requests.set(key, { file: tile, unsubscribe, release })
      }
      const result = queue.get(tile, 'full'), image = result?.image?.canvas
      this.pending ||= !result
      this.error ??= result?.error
      sprites.push({ key: image ? key : file.renderKey, image: image ?? overview,
        source: !image && overview ? { left: region.left / native.width * overview.width, top: region.top / native.height * overview.height,
          width: region.width / native.width * overview.width, height: region.height / native.height * overview.height } : undefined,
        x: rect.left + region.left * zoom, y: rect.top + region.top * zoom, width: region.width * zoom, height: region.height * zoom,
        nearest: !!image && physical >= 1 - 1e-6 })
    }
    return sprites
  }
  end() {
    for (const [key, request] of this.requests) if (!this.wanted.has(key)) {
      request.unsubscribe(); request.release(); this.requests.delete(key)
    }
  }
  get bytes() { return queue.getStats().bytes }
  retry(file?: OutputFile) {
    for (const request of this.requests.values()) {
      if ((!file || request.file.renderKey.startsWith(`${file.renderKey}:region:`)) && queue.get(request.file, 'full')?.error) queue.retry(request.file)
    }
    this.invalidate()
  }
  dispose() { this.wanted.clear(); this.end() }
}
