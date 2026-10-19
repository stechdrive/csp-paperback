import type { CspLayer } from '../../types'
import { ja } from '../../i18n/ja'
import type { ClipDiagnostic, ClipDocument, ClipLayer } from './types'

export function compatibilityAdvice(compatibility: ClipDocument['compatibility']): string {
  return compatibility === 'saved'
    ? '互換情報は保存されていますが、このレイヤーの描画画像を取得できませんでした。'
    : ja.input.clipCompatibilityResave
}

export function materialRenderingMessage(kind: 'vector' | 'text' | '3d', missing: boolean, compatibility: ClipDocument['compatibility']): string {
  const description = missing
    ? `${kind === '3d' ? '3D' : 'ベクター'}レイヤーの描画画像を取得できません。このレイヤーは透明な画像として扱い、ほかの素材の書き出しは続けます。`
    : kind === 'vector'
      ? 'ベクターレイヤーを近似描画しています。線幅・濃さ・ブラシ形状に差が生じる場合があります。'
      : '文字情報から描画します。フォント・縦書き・組版に差が生じる場合があります。'
  return `${description}\n${compatibilityAdvice(compatibility)}`
}

/** Also used by the decoder so callers outside the store get the same notices. */
export function layerRenderingDiagnostics(layer: ClipLayer, compatibility: ClipDocument['compatibility'], paired = false, hasPsdImage = false): ClipDiagnostic[] {
  const result: ClipDiagnostic[] = []
  const add = (message: string, part: ClipDiagnostic['part'], outcome: ClipDiagnostic['outcome'], materialKind?: ClipDiagnostic['materialKind']) => result.push({
    scope: 'raster', layerId: layer.id, message: `「${layer.name}」: ${message}`, rendering: true, part, outcome, materialKind,
  })
  if (paired && !layer.isFolder && hasPsdImage) return result
  const missing3D = layer.unsupported3D || (paired && layer.kind === '3d')
  const vector = paired && layer.kind === 'vector' ? 'unavailable' : layer.vectorRendering
  if (missing3D) add(materialRenderingMessage('3d', true, compatibility), 'material', 'missing-content', '3d')
  else if (vector) add(materialRenderingMessage('vector', vector === 'unavailable', compatibility), 'material', vector === 'unavailable' ? 'missing-content' : 'approximate', 'vector')
  else if (layer.materialSource === 'text') add(materialRenderingMessage('text', false, compatibility), 'material', 'approximate', 'text')
  const effects = layer.effects
  if (paired && layer.isFolder) {
    const names = [effects?.layerColor && 'レイヤーカラー', effects?.edge && '境界線', effects?.watercolor && '水彩境界'].filter(Boolean)
    if (names.length) add(`フォルダの${names.join('・')}はPSDに含まれない場合があります。PSD併用時はこれらの効果を補完していません。描画を確認してください。`, 'effect', 'missing-effect')
  } else if (!paired) {
    if (effects?.layerColor) add('レイヤーカラーを独自処理で再現しています。', 'effect', 'approximate')
    if (effects?.edge?.radius) add('境界線を近似描画しています。輪郭や半透明部分に差が生じる場合があります。', 'effect', 'approximate')
    if (effects?.watercolor) add('水彩境界は反映されません。元の描画は書き出します。互換情報付きで保存しても、この効果は補完されません。', 'effect', 'missing-effect')
  }
  return result
}

/** A PSD only resolves notices for the leaf images it actually supplies. */
export function resolveClipDiagnostics(clip: ClipDocument, tree: CspLayer[], paired: boolean): ClipDiagnostic[] {
  const rendered = new Map<string, CspLayer>()
  const visitTree = (layers: CspLayer[]) => layers.forEach(l => { rendered.set(l.id, l); visitTree(l.children) })
  visitTree(tree)
  const replaced = new Set<string>()
  const generated: ClipDiagnostic[] = []
  const visit = (layers: ClipLayer[]) => layers.forEach(layer => {
    const hasImage = !!rendered.get(`clip:${layer.id}`)?.agPsdRef.canvas
    if (paired && !layer.isFolder && hasImage) replaced.add(layer.id)
    generated.push(...layerRenderingDiagnostics(layer, clip.compatibility, paired, hasImage))
    visit(layer.children)
  })
  visit(clip.layers)
  return [...clip.diagnostics.filter(d => !d.rendering && !(d.scope === 'raster' && d.layerId && (
    replaced.has(d.layerId) || (paired && d.part === 'blend' && rendered.has(`clip:${d.layerId}`))
  ))), ...generated]
}
