import type { CspLayer } from '../types'
import type { ClipDiagnostic } from './clip/types'
import { layerMaterialDiagnostics } from '../engine/material-cache'

export interface RenderIssue {
  layerId: string
  layerName: string
  message: string
  outcome?: ClipDiagnostic['outcome']
}
export function renderIssues(layers: CspLayer[], diagnostics: ClipDiagnostic[] = []): RenderIssue[] {
  const issues: RenderIssue[] = []
  const seen = new Set<string>()
  for (const layer of layers) {
    const own = [...diagnostics.filter(d => d.layerId && `clip:${d.layerId}` === layer.id), ...layerMaterialDiagnostics(layer)]
    for (const diagnostic of own) {
      const key = `${layer.id}:${diagnostic.message}`
      if (seen.has(key)) continue
      seen.add(key)
      issues.push({ layerId: layer.id, layerName: layer.originalName, message: diagnostic.message, outcome: diagnostic.outcome })
    }
  }
  return issues
}
