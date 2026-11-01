import { encodePngRows } from 'celcodec/render'
import type { OutputFile } from './output-plan'
import type { ProjectSettings } from '../types'
import type { ClipDiagnostic } from './clip/types'
import type { RenderIssue } from './render-diagnostics'
import { renderOutputRegion } from './output-region-render'
import { injectDpiPng } from './image-export'
import { releaseCanvas } from '../engine/render-resources'

/** Full-width row buffers, bounded native tiles, then incremental PNG compression.
 * The export destination still owns the compressed Blob; no full RGBA/Canvas is allocated. */
export async function renderClipPng(file: OutputFile, table: ProjectSettings['processTable'], border: boolean,
  diagnostics: ClipDiagnostic[], dpiX: number, dpiY: number, observe: (issues: RenderIssue[]) => void): Promise<Blob> {
  const { width, height } = file.clipDrawing!
  async function* rows() {
    const step = Math.max(1, Math.min(256, Math.floor(16 * 1024 * 1024 / (width * 4))))
    for (let top = 0; top < height; top += step) {
      const h = Math.min(step, height - top), row = new Uint8Array(width * h * 4)
      for (let left = 0; left < width; left += 768) {
        const w = Math.min(768, width - left)
        const result = await renderOutputRegion(file, { left, top, width: w, height: h }, 1, table, border, diagnostics)
        try {
          const pixels = result.canvas.getContext('2d')!.getImageData(0, 0, w, h).data
          for (let y = 0; y < h; y++) row.set(pixels.subarray(y * w * 4, (y + 1) * w * 4), (y * width + left) * 4)
          observe(result.diagnostics ?? [])
        } finally { releaseCanvas(result.canvas) }
        await new Promise<void>(resolve => setTimeout(resolve, 0))
      }
      yield row
    }
  }
  const chunks: BlobPart[] = []
  for await (const chunk of encodePngRows(width, height, rows())) chunks.push(new Blob([chunk as Uint8Array<ArrayBuffer>]))
  const blob = new Blob(chunks, { type: 'image/png' })
  return dpiX > 0 && dpiY > 0 ? injectDpiPng(blob, dpiX, dpiY) : blob
}
