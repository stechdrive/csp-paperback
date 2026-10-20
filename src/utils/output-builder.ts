import type { OutputConfig, OutputEntry } from '../types'
import type { ExportEntry, ExportProgressCallback } from '../types/output'
import { canvasToBlob, replaceExtension } from './image-export'
import { resolveEntryNames } from './naming'
import { sanitizeOutputPath, sanitizePathSegment } from './path-sanitize'

export interface PreparedOutputEntry {
  relativePath: string
  segments: string[]
  fileName: string
  names: { path: string; flatName: string }
}

export interface StreamedOutputEntry extends PreparedOutputEntry {
  input: Blob
}

export function prepareOutputEntries(
  entries: Pick<OutputEntry, 'path' | 'flatName' | 'prepared'>[],
  config: OutputConfig,
): PreparedOutputEntry[] {
  if (entries.every(entry => entry.prepared)) return entries.map(entry => entry.prepared!)
  const normalizedEntries = entries.map(e => ({
    ...e,
    path: sanitizeOutputPath(replaceExtension(e.path, config.format)),
    flatName: sanitizeOutputPath(replaceExtension(e.flatName, config.format)),
  }))
  const resolved = resolveEntryNames(normalizedEntries)

  return resolved.map(entry => {
    const relativePath = config.structure === 'hierarchy' ? entry.path : entry.flatName
    const segments = relativePath.split('/').filter(Boolean)
    const fileName = segments[segments.length - 1] ?? '_'
    return { relativePath, segments, fileName, names: { path: entry.path, flatName: entry.flatName } }
  })
}

export async function* streamOutputEntries(
  preparedEntries: PreparedOutputEntry[],
  originalEntries: ExportEntry[],
  config: OutputConfig,
  dpiX: number,
  dpiY: number,
  onProgress?: ExportProgressCallback,
): AsyncGenerator<StreamedOutputEntry> {
  const total = preparedEntries.length
  try {
    for (let i = 0; i < total; i++) {
      const prepared = preparedEntries[i]
      const original = originalEntries[i]
      const lazy = 'createCanvas' in original
      if (lazy) {
        onProgress?.(i, total, { phase: 'rendering', path: prepared.relativePath })
        // Let React, input handling and the progress bar paint between images.
        await new Promise<void>(resolve => setTimeout(resolve, 0))
      }
      const canvas = lazy ? await original.createCanvas() : original.canvas
      if (!canvas) continue
      let blob: Blob
      try {
        if (lazy) onProgress?.(i, total, { phase: 'encoding', path: prepared.relativePath })
        blob = await canvasToBlob(canvas, config.format, config.jpgQuality, dpiX, dpiY)
      } finally {
        if (lazy) { canvas.width = 1; canvas.height = 1 }
        else (original as { canvas: HTMLCanvasElement | null }).canvas = null
      }
      if (lazy) onProgress?.(i, total, { phase: 'writing', path: prepared.relativePath })
      yield { ...prepared, input: blob }
      onProgress?.(i + 1, total)
    }
  } finally {
    for (const entry of originalEntries) if ('createCanvas' in entry) entry.releaseRenderCache?.()
  }
}

export function makeExportBaseName(psdFileName: string): string {
  const dotIndex = psdFileName.lastIndexOf('.')
  const baseName = dotIndex >= 0 ? psdFileName.slice(0, dotIndex) : psdFileName
  return sanitizePathSegment(baseName || 'export')
}
