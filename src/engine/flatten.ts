import type { CspLayer, FlatLayer } from '../types'
import { collectAnimFolderAncestorIds } from './tree-builder'
import { compositeGroup, compositeStack, createCanvas } from './compositor'

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
 * extraIgnoreOpacityIds: 不透明度を100%として扱うレイヤーIDの追加セット（工程フォルダ等）。
 * アニメーションフォルダとその直接の子（セルフォルダ・単体セルレイヤー）は
 * 常に100%として扱う（構造的コンテナ）。
 */
export function flattenTree(
  rootChildren: CspLayer[],
  docWidth: number,
  docHeight: number,
  selectedCellIndices?: Map<string, number>, // アニメフォルダID→選択セルインデックス（プレビュー用）
  extraIgnoreOpacityIds?: Set<string>,       // 追加の不透明度無視ID（工程フォルダ等）
): FlatLayer[] {
  const animAncestorIds = collectAnimFolderAncestorIds(rootChildren)

  // 構造的コンテナのIDを収集し、不透明度を100%として扱う対象に追加する。
  // アニメフォルダ本体とその直接の子（セルフォルダ or 単体セルレイヤー）が対象。
  const ignoreOpacityIds = new Set<string>(extraIgnoreOpacityIds ?? [])
  function collectStructuralIds(layers: CspLayer[]): void {
    for (const layer of layers) {
      if (layer.isAnimationFolder) {
        ignoreOpacityIds.add(layer.id)
        for (const child of layer.children) {
          ignoreOpacityIds.add(child.id)  // セルフォルダ or 単体セルレイヤー
        }
      }
      collectStructuralIds(layer.children)
    }
  }
  collectStructuralIds(rootChildren)

  function flattenLayer(layer: CspLayer): FlatLayer[] {
    // 非表示は合成不参加
    if (layer.hidden || layer.uiHidden) return []

    // 構造的コンテナは100%、アートワークコンテンツはオパシティを尊重
    const effectiveOpacity = ignoreOpacityIds.has(layer.id) ? 100 : layer.opacity

    // アニメーションフォルダ（例外：アニメフォルダ自身はcell-extractorが担当）
    // プレビュー目的では選択セルを合成して1枚にする
    if (layer.isAnimationFolder) {
      const cellIndex = selectedCellIndices?.get(layer.id) ?? 0
      const visibleChildren = layer.children.filter(c => !c.hidden && !c.uiHidden)
      if (visibleChildren.length === 0) return []
      const selectedCell = visibleChildren[Math.min(cellIndex, visibleChildren.length - 1)]
      const cellFlats = flattenLayer(selectedCell)
      if (cellFlats.length === 0) return []
      const cellCanvas = compositeGroup(cellFlats, docWidth, docHeight)
      return [{
        canvas: cellCanvas,
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
        return childFlats
      } else {
        // 非Pass Through: 子を合成して1枚のFlatLayerに
        const groupCanvas = compositeGroup(childFlats, docWidth, docHeight)
        return [{
          canvas: groupCanvas,
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

    return [{
      canvas,
      blendMode: layer.blendMode,
      opacity: effectiveOpacity,
      top: layer.top,
      left: layer.left,
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
