import type { CspLayer } from '../types'
import type { ClipDiagnostic } from './clip/types'
import { layerMaterialDiagnostics } from '../engine/material-cache'
import { isMediaLayer } from './layer-display'

export interface RenderIssue extends Pick<ClipDiagnostic, 'code' | 'part' | 'outcome' | 'materialKind'> {
  layerId: string
  layerName: string
  message: string
  scope?: ClipDiagnostic['scope']
}
export function renderIssues(layers: CspLayer[], diagnostics: ClipDiagnostic[] = []): RenderIssue[] {
  const issues: RenderIssue[] = []
  const seen = new Set<string>()
  const byLayer = new Map<string, ClipDiagnostic[]>()
  for (const diagnostic of diagnostics) {
    if (!diagnostic.layerId) continue
    const id = `clip:${diagnostic.layerId}`
    const own = byLayer.get(id) ?? []
    own.push(diagnostic)
    byLayer.set(id, own)
  }
  for (const layer of layers) {
    if (isMediaLayer(layer)) continue
    const own = [...(byLayer.get(layer.id) ?? []), ...layerMaterialDiagnostics(layer)]
    for (const diagnostic of own) {
      const key = JSON.stringify([layer.id, diagnostic.scope, diagnostic.part, diagnostic.outcome, diagnostic.code, diagnostic.message])
      if (seen.has(key)) continue
      seen.add(key)
      issues.push({ ...diagnostic, layerId: layer.id, layerName: layer.originalName, outcome: diagnostic.outcome })
    }
  }
  return issues
}

/** Include decoded materials without decoding hidden or otherwise unused layers. */
export function documentRenderIssues(tree: CspLayer[], diagnostics: ClipDiagnostic[]): RenderIssue[] {
  const flatten = (layers: CspLayer[]): CspLayer[] => layers.flatMap(layer => [layer, ...flatten(layer.children)])
  const layers = flatten(tree), ids = new Set(layers.map(layer => layer.id))
  return [...renderIssues(layers, diagnostics), ...diagnostics.filter(d => !d.layerId || !ids.has(`clip:${d.layerId}`))
    .map(d => ({ ...d, layerId: d.layerId ? `clip:${d.layerId}` : '', layerName: '' }))]
}

const titles: Record<string, string> = {
  APPROXIMATE_VECTOR: 'ベクターの近似描画',
  APPROXIMATE_TEXT: '文字の近似描画',
  APPROXIMATE_WATERCOLOR: '水彩境界の近似描画',
  APPROXIMATE_BRUSH_ROTATION: 'ブラシ先端の向きの近似',
  APPROXIMATE_BRUSH_RANDOM: 'ブラシのランダム変化の近似',
  MISSING_BRUSH_SETTINGS: 'ブラシ設定の代用',
  MISSING_BRUSH_TIP: 'ブラシ先端画像の欠落',
  UNSUPPORTED_BRUSH_COMPOSITE: 'ブラシの一部設定が未対応',
  MISSING_VECTOR_DATA: 'ベクター画像を取得できません',
  MISSING_MATERIAL: '素材画像の復元失敗',
  MISSING_VECTOR_STROKE: '一部のストロークの描画失敗',
  MISSING_VECTOR_REMAINDER: '残りのストロークの描画中断',
  UNSUPPORTED_3D: '3D画像を取得できません',
  UNSUPPORTED_TONE: 'トーンが未対応',
  UNSUPPORTED_WATERCOLOR_STYLE: '水彩境界の種類が未対応',
  PSD_FOLDER_EFFECT: 'PSDのフォルダ効果を要確認',
  UNSUPPORTED_LAYER_BLEND: '合成モードが未対応',
}

export interface RenderIssueGroup {
  key: string
  title: string
  message: string
  issues: RenderIssue[]
}

export function groupRenderIssues(issues: RenderIssue[]): RenderIssueGroup[] {
  const groups = new Map<string, RenderIssueGroup>()
  for (const issue of issues) {
    const prefix = `「${issue.layerName}」: `
    const message = issue.layerName && issue.message.startsWith(prefix) ? issue.message.slice(prefix.length) : issue.message
    // Keep different causes/parameters separate, including unknown diagnostics.
    const key = JSON.stringify([issue.scope, issue.part, issue.outcome, issue.code, message])
    let group = groups.get(key)
    if (!group) {
      group = { key, title: titles[issue.code ?? ''] ?? message, message, issues: [] }
      groups.set(key, group)
    }
    if (!group.issues.some(item => item.layerId === issue.layerId)) group.issues.push(issue)
  }
  return [...groups.values()]
}
