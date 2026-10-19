import { canvasSources } from '../engine/render-sources'
import type { ExportEntry, OutputConfig } from '../types/output'
import type { ClipDiagnostic } from './clip/types'

/** Observe already-rendered output, without rendering early or retaining its pixels. */
export function trackExportDiagnostics(entries: ExportEntry[], diagnostics: ClipDiagnostic[], config: OutputConfig) {
  if (!diagnostics.length) return { entries, messages: () => [] as string[] }
  const messages = new Set(diagnostics.filter(d => !d.layerId).map(d => d.message))
  const observe = (canvas: HTMLCanvasElement, entry: ExportEntry) => {
    const ids = canvasSources(canvas)
    const name = config.structure === 'flat' ? entry.flatName : entry.path
    for (const d of diagnostics) if (d.layerId && ids.has(`clip:${d.layerId}`)) messages.add(`${name} — ${d.message}`)
    return canvas
  }
  return {
    entries: entries.map(entry => 'createCanvas' in entry
      ? { ...entry, createCanvas: () => observe(entry.createCanvas(), entry) }
      : { ...entry, canvas: observe(entry.canvas, entry) }),
    messages: () => [...messages],
  }
}
