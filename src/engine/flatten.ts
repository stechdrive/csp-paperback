import type { CspLayer, FlatLayer } from '../types'
import { collectAnimFolderAncestorIds } from './tree-builder'
import { applyLayerMask, compositeGroup, compositeStack, createCanvas } from './compositor'

/**
 * コアフラット化アルゴリズム
 *
 * ルール:
 * - 非表示レイヤー/uiHidden → 合成不参加（空配列）
 * - 通常レイヤー → そのまま（不透明度100%）
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
    // 非表示は合成不参加
    if (layer.hidden || layer.uiHidden) return []

    // extraIgnoreOpacityIds に含まれるIDは100%として扱う（工程フォルダ本体等）
    // 指定がない場合は layer.opacity をそのまま使用（生のPSD状態を反映）
    const effectiveOpacity = extraIgnoreOpacityIds?.has(layer.id) ? 100 : layer.opacity

    // アニメーションフォルダ（例外：アニメフォルダ自身はcell-extractorが担当）
    // プレビュー目的では選択セルを合成して1枚にする
    if (layer.isAnimationFolder) {
      const cellIndex = selectedCellIndices?.get(layer.id) ?? 0
      // カラ（-1）: このトラックは何も表示しない
      if (cellIndex < 0) return []
      const visibleChildren = layer.children.filter(c => !c.hidden && !c.uiHidden)
      if (visibleChildren.length === 0) return []
      const selectedCell = visibleChildren[Math.min(cellIndex, visibleChildren.length - 1)]
      const cellFlats = flattenLayer(selectedCell)
      if (cellFlats.length === 0) return []
      const rawCanvas = compositeGroup(cellFlats, docWidth, docHeight)
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
      }]
    }

    // アニメーションフォルダの祖先フォルダ（例外ルール）
    // → 子を個別にフラット化して合成せずに返す
    if (layer.isFolder && animAncestorIds.has(layer.id)) {
      const childFlats: FlatLayer[] = []
      // ツリーはトップファーストなので合成はボトムから（逆順）処理する
      for (const child of [...layer.children].reverse()) {
        childFlats.push(...flattenLayer(child))
      }
      return childFlats
    }

    // 通常フォルダ（アニメ子孫なし）
    if (layer.isFolder) {
      const childFlats: FlatLayer[] = []
      // ツリーはトップファーストなので合成はボトムから（逆順）処理する
      for (const child of [...layer.children].reverse()) {
        childFlats.push(...flattenLayer(child))
      }
      if (childFlats.length === 0) return []

      if (layer.blendMode === 'pass through') {
        // Pass Through: 子をそのまま親のスタックに展開（中間キャンバスなし）
        // フォルダマスクはPass Throughでは子ごとに適用できないためスキップ（v1制限）
        return childFlats
      } else {
        // 非Pass Through: 子を合成して1枚のFlatLayerに
        const rawCanvas = compositeGroup(childFlats, docWidth, docHeight)
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
        }]
      }
    }

    // 通常レイヤー
    const canvas = layer.agPsdRef.canvas
    if (!canvas) return []

    const maskData = layer.agPsdRef.mask
    const hasMask = !!(maskData?.canvas && !maskData.disabled)
    const finalCanvas = hasMask
      ? applyLayerMask(canvas, layer.top, layer.left, maskData!, docWidth, docHeight)
      : canvas

    return [{
      canvas: finalCanvas,
      blendMode: layer.blendMode,
      opacity: effectiveOpacity,
      top: hasMask ? 0 : layer.top,
      left: hasMask ? 0 : layer.left,
      sourceId: layer.id,
      clipping: layer.clipping,
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
  const flatLayers = flattenTree(rootChildren, docWidth, docHeight, selectedCellIndices)
  return compositeRoot(flatLayers, docWidth, docHeight, background)
}
