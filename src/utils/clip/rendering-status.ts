import type { CspLayer } from '../../types'
import { ja } from '../../i18n/ja'
import type { ClipDiagnostic, ClipDocument, ClipLayer } from './types'
import { isMediaKind } from '../layer-display'

export function compatibilityAdvice(compatibility: ClipDocument['compatibility']): string {
  return compatibility === 'saved'
    ? '互換情報は保存されていますが、一部のレイヤーの描画画像を取得できませんでした。'
    : ja.input.clipCompatibilityResave
}

export function materialRenderingMessage(kind: 'vector' | 'text' | '3d', missing: boolean): string {
  const description = missing
    ? `${kind === '3d' ? '3D' : 'ベクター'}レイヤーの描画画像を取得できません。このレイヤーは透明な画像として扱い、ほかの素材の書き出しは続けます。`
    : kind === 'vector'
      ? 'ベクターレイヤーを近似描画しています。線幅・濃さ・ブラシ形状に差が生じる場合があります。'
      : '文字情報から描画します。フォント・縦書き・組版に差が生じる場合があります。'
  return description
}

/** Also used by the decoder so callers outside the store get the same notices. */
export function layerRenderingDiagnostics(layer: ClipLayer, _compatibility: ClipDocument['compatibility'], paired = false, hasPsdImage = false): ClipDiagnostic[] {
  const result: ClipDiagnostic[] = []
  if (isMediaKind(layer.kind)) return result
  const add = (code: string, message: string, part: ClipDiagnostic['part'], outcome: ClipDiagnostic['outcome'], materialKind?: ClipDiagnostic['materialKind']) => result.push({
    scope: 'raster', layerId: layer.id, code, message: `「${layer.name}」: ${message}`, rendering: true, part, outcome, materialKind,
  })
  if (paired && !layer.isFolder && hasPsdImage) return result
  const missing3D = layer.unsupported3D || (paired && layer.kind === '3d')
  const vector = paired && layer.kind === 'vector' ? 'unavailable' : layer.vectorRendering
  if (missing3D) add('UNSUPPORTED_3D', materialRenderingMessage('3d', true), 'material', 'missing-content', '3d')
  else if (vector) add(vector === 'unavailable' ? 'MISSING_VECTOR_DATA' : 'APPROXIMATE_VECTOR', materialRenderingMessage('vector', vector === 'unavailable'), 'material', vector === 'unavailable' ? 'missing-content' : 'approximate', 'vector')
  else if (layer.materialSource === 'text') add('APPROXIMATE_TEXT', materialRenderingMessage('text', false), 'material', 'approximate', 'text')
  const effects = layer.effects
  if (paired && layer.isFolder) {
    const names = [effects?.layerColor && 'レイヤーカラー', effects?.edge && '境界線', effects?.watercolor && '水彩境界', effects?.tone && 'トーン'].filter(Boolean)
    if (names.length) add('PSD_FOLDER_EFFECT', `フォルダの${names.join('・')}はPSDに含まれない場合があります。PSD併用時はこれらの効果を補完していません。描画を確認してください。`, 'effect', 'missing-effect')
  } else if (!paired) {
    if (effects?.watercolor) {
      if (effects.watercolor.style) add('UNSUPPORTED_WATERCOLOR_STYLE', 'この種類の水彩境界には未対応です。効果を除いた元の描画を書き出します。', 'effect', 'missing-effect')
      else add('APPROXIMATE_WATERCOLOR', '水彩境界を近似描画しています。縁の濃さやぼかしに差が生じる場合があります。', 'effect', 'approximate')
    }
    if (effects?.tone) add('UNSUPPORTED_TONE', 'トーンには未対応です。トーン化前の描画を書き出します。', 'effect', 'missing-effect')
  }
  return result
}

/** A PSD only resolves notices for the leaf images it actually supplies. */
export function resolveClipDiagnostics(clip: ClipDocument, tree: CspLayer[], paired: boolean): ClipDiagnostic[] {
  const rendered = new Map<string, CspLayer>()
  const visitTree = (layers: CspLayer[]) => layers.forEach(l => { rendered.set(l.id, l); visitTree(l.children) })
  visitTree(tree)
  const replaced = new Set<string>()
  const excluded = new Set<string>()
  const generated: ClipDiagnostic[] = []
  const visit = (layers: ClipLayer[]) => layers.forEach(layer => {
    if (isMediaKind(layer.kind)) excluded.add(layer.id)
    const ref = rendered.get(`clip:${layer.id}`)?.agPsdRef
    const hasImage = !!ref && (!!ref.canvas || hasDeferredMaterial(ref))
    if (paired && !layer.isFolder && hasImage) replaced.add(layer.id)
    generated.push(...layerRenderingDiagnostics(layer, clip.compatibility, paired, hasImage))
    visit(layer.children)
  })
  visit(clip.layers)
  return [...clip.diagnostics.filter(d => !d.rendering && !(d.scope === 'raster' && d.layerId && (
    excluded.has(d.layerId) || replaced.has(d.layerId) || (paired && d.part === 'blend' && rendered.has(`clip:${d.layerId}`))
  ))), ...generated]
}
import { hasDeferredMaterial } from '../../engine/material-cache'
