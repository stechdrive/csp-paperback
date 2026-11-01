import * as native from 'celcodec/material'
import type { ClipDiagnostic as NativeDiagnostic } from 'celcodec'
import type { ClipLayer, ClipDiagnostic, ClipDocument } from './types'
import type { ClipRow } from './records'
import { layerRenderingDiagnostics } from './rendering-status'
import { codecCall, codecDiagnostic, codecFunction, codecMessage } from './celcodec'

export type { MaterialTables } from 'celcodec/material'
export const materialOffscreen = codecFunction(native.materialOffscreen)
export const readMaterialQuad = codecFunction(native.readMaterialQuad)
export function readMaterialEffects(row: ClipRow, report?: (message: string, code: string) => void) {
  return codecCall(() => native.readMaterialEffects(row, report ? code => report(codecMessage(code), code) : undefined))
}
const renderingCodes = new Set(['APPROXIMATE_VECTOR', 'APPROXIMATE_TEXT', 'UNSUPPORTED_3D',
  'APPROXIMATE_WATERCOLOR', 'UNSUPPORTED_WATERCOLOR_STYLE', 'UNSUPPORTED_TONE'])

/** Localize structured results; the library distinguishes empty/missing/malformed vectors. */
export function materialDiagnostics(result: readonly NativeDiagnostic[], layer: ClipLayer,
  compatibility?: ClipDocument['compatibility']): ClipDiagnostic[] {
  const rendering = layerRenderingDiagnostics(layer, compatibility).map(local => {
    const diagnostic = result.find(d => d.code === local.code)
    return diagnostic ? { ...codecDiagnostic(diagnostic, layer), ...local } : local
  })
  return [...result.filter(d => !renderingCodes.has(d.code)
    && !(d.code === 'MISSING_VECTOR_DATA' && layer.vectorRendering === 'unavailable'))
    .map(d => codecDiagnostic(d, layer)), ...rendering]
}

/** Low-level public API boundary retained for the independent material regression corpus. */
export function createMaterialDecoder(t: native.MaterialTables, width: number, height: number,
  dpi: number, diagnostics: ClipDiagnostic[], compatibility?: ClipDocument['compatibility']) {
  const result: NativeDiagnostic[] = []
  const decode = native.createMaterialDecoder(t, width, height, dpi, result, compatibility,
    { source: 'original', budget: 'cropped', maxDecodedBytes: 384 * 1024 * 1024 })
  return async (layer: ClipLayer, row: ClipRow) => {
    result.length = 0
    await codecCall(() => decode(layer, row))
    diagnostics.push(...materialDiagnostics(result, layer, compatibility))
  }
}
