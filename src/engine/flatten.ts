import { applyMaterialEffects } from './material-effects'
import { includeContainer } from './render-sources'
import type { CspLayer, FlatLayer } from '../types'
import { collectAnimFolderAncestorIds } from './tree-builder'
import { applyLayerMask, compositeGroup, compositeStack, createCanvas } from './compositor'
import { resolveSelectedAnimCell } from '../utils/anim-cell-selection'
import { withCanvasResources } from './render-resources'
import { collectingMaterials, visitMaterial } from './material-dependencies'
import { resolvedMaterialLayer } from './material-cache'
import { isMediaLayer } from '../utils/layer-display'

/**
 * コアフラット化アルゴリズム
 *
 * ルール:
 * - 非表示レイヤー/uiHidden → 合成不参加（空配列）
 * - 通常レイヤー → ポリシー適用後の不透明度でFlatLayer化
 * - フォルダ(pass through) + アニメ子孫なし → 子をそのまま親に展開（通過）
 * - フォルダ(非pass through) + アニメ子孫なし → 子を合成して1枚に
 * - アニメーションフォルダ → プレビュー時は最初のセルを合成（実export時はcell-extractorが担当）
 * - フォルダ + アニメ子孫あり（例外ルール）→ 子を個別にフラット化してそのまま返す
 */

/**
 * ルート直下のレイヤー群をフラット化してFlatLayer[]を返す
 *
 * extraIgnoreOpacityIds: 不透明度を100%として扱うレイヤーIDのセット（工程フォルダ本体等）。
 * 省略時はすべてのレイヤーの layer.opacity をそのまま使用（グローバルプレビュー向け）。
 */
export function flattenTree(
  rootChildren: CspLayer[],
  docWidth: number,
  docHeight: number,
  selectedCellIndices?: Map<string, number>, // アニメフォルダID→選択セルインデックス（プレビュー用）
  extraIgnoreOpacityIds?: Set<string>,       // 追加の不透明度無視ID（工程フォルダ等）
): FlatLayer[] {
  const animAncestorIds = collectAnimFolderAncestorIds(rootChildren)

  function flattenLayer(layer: CspLayer): FlatLayer[] {
    return withCanvasResources(() => flattenLayerContent(layer), flats => flats.map(flat => flat.canvas))
  }

  function flattenLayerContent(layer: CspLayer): FlatLayer[] {
    // 非表示は合成不参加
    if (isMediaLayer(layer) || layer.hidden || layer.uiHidden) return []
    if (collectingMaterials()) visitMaterial(layer)
    else layer = resolvedMaterialLayer(layer)

    // extraIgnoreOpacityIds に含まれるIDは100%として扱う（工程フォルダ本体等）
    // 指定がない場合は layer.opacity をそのまま使用（生のPSD状態を反映）
    const effectiveOpacity = extraIgnoreOpacityIds?.has(layer.id) ? 100 : layer.opacity

    // アニメーションフォルダ（例外：アニメフォルダ自身はcell-extractorが担当）
    // プレビュー目的では選択セルを合成して1枚にする
    if (layer.isAnimationFolder) {
      const selection = resolveSelectedAnimCell(layer, selectedCellIndices?.get(layer.id))
      if (!selection) return []
      const selectedCell = selection.cell
      const cellFlats = flattenLayer(selectedCell)
      if (cellFlats.length === 0) return []
      const rawCanvas = applyMaterialEffects(compositeGroup(cellFlats, docWidth, docHeight), 0, 0, layer.materialEffects, docWidth, docHeight)
      const maskData = layer.agPsdRef.mask
      const finalCanvas = (maskData?.canvas && !maskData.disabled)
        ? applyLayerMask(rawCanvas, 0, 0, maskData, docWidth, docHeight)
        : rawCanvas
      return [{
        canvas: finalCanvas,
        blendMode: layer.blendMode,
        opacity: effectiveOpacity,
        top: 0,
        left: 0,
        sourceId: layer.id,
        clipping: layer.clipping,
        nativeBlendMode: layer.nativeBlendMode,
      }]
    }

    // アニメーションフォルダの祖先フォルダ（例外ルール）
    // → 描画効果がなければ、子を個別にフラット化して合成せずに返す
    if (layer.isFolder && animAncestorIds.has(layer.id) && !layer.materialEffects) {
      const childFlats: FlatLayer[] = []
      // ツリーはトップファーストなので合成はボトムから（逆順）処理する
      for (const child of [...layer.children].reverse()) {
        childFlats.push(...flattenLayer(child))
      }
      return includeContainer(childFlats, layer.id)
    }

    // 通常フォルダ（アニメ子孫なし）
    if (layer.isFolder) {
      const childFlats: FlatLayer[] = []
      // ツリーはトップファーストなので合成はボトムから（逆順）処理する
      for (const child of [...layer.children].reverse()) {
        childFlats.push(...flattenLayer(child))
      }
      if (childFlats.length === 0) return []

      if (layer.blendMode === 'pass through' && !layer.materialEffects) {
        // Pass Through: 子をそのまま親のスタックに展開（中間キャンバスなし）
        // フォルダマスクはPass Throughでは子ごとに適用できないためスキップ（v1制限）
        return includeContainer(childFlats, layer.id)
      } else {
        // 非Pass Through: 子を合成して1枚のFlatLayerに
        const rawCanvas = applyMaterialEffects(compositeGroup(childFlats, docWidth, docHeight), 0, 0, layer.materialEffects, docWidth, docHeight)
        const maskData = layer.agPsdRef.mask
        const finalCanvas = (maskData?.canvas && !maskData.disabled)
          ? applyLayerMask(rawCanvas, 0, 0, maskData, docWidth, docHeight)
          : rawCanvas
        return [{
          canvas: finalCanvas,
          blendMode: layer.blendMode,
          opacity: animAncestorIds.has(layer.id) ? 100 : effectiveOpacity,
          top: 0,
          left: 0,
          sourceId: layer.id,
          clipping: layer.clipping,
          nativeBlendMode: layer.nativeBlendMode,
        }]
      }
    }

    // 通常レイヤー
    if (collectingMaterials()) return []
    const sourceCanvas = layer.agPsdRef.canvas ?? (layer.vectorRendering || layer.unsupported3D || layer.materialMissing ? createCanvas(1, 1) : undefined)
    if (!sourceCanvas) return []
    const canvas = applyMaterialEffects(sourceCanvas, layer.left, layer.top, layer.materialEffects, docWidth, docHeight, true)
    const fullSize = canvas !== sourceCanvas

    const maskData = layer.agPsdRef.mask
    const hasMask = !!(maskData?.canvas && !maskData.disabled)
    const finalCanvas = hasMask
      ? applyLayerMask(canvas, fullSize ? 0 : layer.top, fullSize ? 0 : layer.left, maskData!, docWidth, docHeight)
      : canvas

    return [{
      canvas: finalCanvas,
      blendMode: layer.blendMode,
      opacity: effectiveOpacity,
      top: hasMask || fullSize ? 0 : layer.top,
      left: hasMask || fullSize ? 0 : layer.left,
      sourceId: layer.id,
      clipping: layer.clipping,
      nativeBlendMode: layer.nativeBlendMode,
      adjustment: layer.adjustment,
      vectorWarning: !!layer.vectorRendering,
      unsupported3D: layer.unsupported3D,
    }]
  }

  const result: FlatLayer[] = []
  // ツリーはトップファーストなので合成はボトムから（逆順）処理する
  for (const layer of [...rootChildren].reverse()) {
    result.push(...flattenLayer(layer))
  }
  return result
}

/**
 * フラット化済みレイヤー群を最終合成して1枚のキャンバスを返す
 */
export function compositeRoot(
  flatLayers: FlatLayer[],
  docWidth: number,
  docHeight: number,
  background: 'white' | 'transparent' = 'white'
): HTMLCanvasElement {
  if (collectingMaterials()) return createCanvas(1, 1)
  if (flatLayers.length === 0) {
    const empty = createCanvas(docWidth, docHeight)
    if (background === 'white') {
      const ctx = empty.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, docWidth, docHeight)
    }
    return empty
  }
  return compositeStack(flatLayers, docWidth, docHeight, background)
}

/**
 * PSDを1枚の画像にフラット化して返す（プレビュー用のメイン関数）
 */
export function flattenToCanvas(
  rootChildren: CspLayer[],
  docWidth: number,
  docHeight: number,
  background: 'white' | 'transparent' = 'white',
  selectedCellIndices?: Map<string, number>
): HTMLCanvasElement {
  return withCanvasResources(() => {
    const flatLayers = flattenTree(rootChildren, docWidth, docHeight, selectedCellIndices)
    return compositeRoot(flatLayers, docWidth, docHeight, background)
  }, canvas => [canvas])
}
