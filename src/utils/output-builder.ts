import type { OutputConfig, OutputEntry } from '../types'
import { canvasToBlob, replaceExtension } from './image-export'
import { resolveEntryNames } from './naming'
import { sanitizeOutputPath, sanitizePathSegment } from './path-sanitize'

export interface PreparedOutputEntry {
  relativePath: string
  segments: string[]
  fileName: string
}

export interface StreamedOutputEntry extends PreparedOutputEntry {
  input: Blob
}

export function prepareOutputEntries(
  entries: OutputEntry[],
  config: OutputConfig,
): PreparedOutputEntry[] {
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
    return { relativePath, segments, fileName }
  })
}

export async function* streamOutputEntries(
  preparedEntries: PreparedOutputEntry[],
  originalEntries: OutputEntry[],
  config: OutputConfig,
  dpiX: number,
  dpiY: number,
  onProgress?: (done: number, total: number) => void,
): AsyncGenerator<StreamedOutputEntry> {
  const total = preparedEntries.length
  for (let i = 0; i < total; i++) {
    const prepared = preparedEntries[i]
    const original = originalEntries[i]
    const canvas = original.canvas
    if (!canvas) continue

    const blob = await canvasToBlob(canvas, config.format, config.jpgQuality, dpiX, dpiY)
    ;(original as { canvas: HTMLCanvasElement | null }).canvas = null

    onProgress?.(i + 1, total)
    yield { ...prepared, input: blob }
  }
}

export function makeExportBaseName(psdFileName: string): string {
  const dotIndex = psdFileName.lastIndexOf('.')
  const baseName = dotIndex >= 0 ? psdFileName.slice(0, dotIndex) : psdFileName
  return sanitizePathSegment(baseName || 'export')
}
