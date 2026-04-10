import type { LayerMaskData } from 'ag-psd'
import type { BlendMode, FlatLayer } from '../types'

/**
 * ag-psdのBlendModeをCanvasのglobalCompositeOperationにマッピング
 * nullはソフトウェアフォールバックが必要
 */
export function blendModeToCompositeOp(mode: BlendMode): GlobalCompositeOperation | null {
  switch (mode) {
    case 'normal':      return 'source-over'
    case 'multiply':    return 'multiply'
    case 'screen':      return 'screen'
    case 'overlay':     return 'overlay'
    case 'darken':      return 'darken'
    case 'lighten':     return 'lighten'
    case 'color dodge': return 'color-dodge'
    case 'color burn':  return 'color-burn'
    case 'hard light':  return 'hard-light'
    case 'soft light':  return 'soft-light'
    case 'difference':  return 'difference'
    case 'exclusion':   return 'exclusion'
    case 'hue':         return 'hue'
    case 'saturation':  return 'saturation'
    case 'color':       return 'color'
    case 'luminosity':  return 'luminosity'
    case 'pass through': return 'source-over' // ルート合成時はnormal扱い
    // ソフトウェアフォールバックが必要なモード
    case 'dissolve':
    case 'linear burn':
    case 'darker color':
    case 'linear dodge':
    case 'lighter color':
    case 'vivid light':
    case 'linear light':
    case 'pin light':
    case 'hard mix':
    case 'subtract':
    case 'divide':
      return null
    default:
      return 'source-over'
  }
}

/** Canvas APIでネイティブ対応していない合成モードかどうかを返す */
export function isUnsupportedBlendMode(mode: BlendMode): boolean {
  return blendModeToCompositeOp(mode) === null
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

/**
 * FlatLayerを1枚のキャンバスに描画する
 * clippingレイヤーは直前の非clippingレイヤー（ベース）のアルファで切り抜く
 */
export function compositeStack(
  layers: FlatLayer[],
  width: number,
  height: number,
  background: 'white' | 'transparent' = 'white'
): HTMLCanvasElement {
  const output = createCanvas(width, height)
  const ctx = output.getContext('2d')!

  if (background === 'white') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }

  // ベースレイヤーの追跡（クリッピングマスク用）
  let baseLayer: FlatLayer | null = null

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]

    if (!layer.clipping) {
      // 通常レイヤー: そのまま合成してベースとして記録
      drawLayer(ctx, layer)
      baseLayer = layer
    } else {
      // クリッピングレイヤー: ベースのアルファで切り抜いてから合成
      if (baseLayer === null) {
        // ベースがない場合はスキップ
        continue
      }
      const clipped = applyClippingMask(layer, baseLayer, width, height)
      const clippedFlat: FlatLayer = { ...layer, canvas: clipped, clipping: false, top: 0, left: 0 }
      drawLayer(ctx, clippedFlat)
    }
  }

  return output
}

/**
 * 単一レイヤーをコンテキストに描画
 */
export function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: FlatLayer
): void {
  const compositeOp = blendModeToCompositeOp(layer.blendMode)

  const alpha = layer.opacity / 100
  if (compositeOp !== null) {
    ctx.save()
    ctx.globalCompositeOperation = compositeOp
    ctx.globalAlpha = alpha
    ctx.drawImage(layer.canvas, layer.left, layer.top)
    ctx.restore()
  } else {
    // ソフトウェアフォールバック（v1では未実装、通常合成で代替）
    // TODO: v1.1でPDF Reference 1.7準拠のピクセル演算を実装
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = alpha
    ctx.drawImage(layer.canvas, layer.left, layer.top)
    ctx.restore()
  }
}

/**
 * クリッピングマスクを適用した結果キャンバスを返す
 * clippingLayerをbaseLayerのアルファで切り抜く
 */
function applyClippingMask(
  clippingLayer: FlatLayer,
  baseLayer: FlatLayer,
  width: number,
  height: number
): HTMLCanvasElement {
  const temp = createCanvas(width, height)
  const tempCtx = temp.getContext('2d')!

  // クリッピングレイヤーを描画
  tempCtx.drawImage(clippingLayer.canvas, clippingLayer.left, clippingLayer.top)

  // ベースレイヤーのアルファで切り抜き（destination-in）
  tempCtx.globalCompositeOperation = 'destination-in'
  tempCtx.drawImage(baseLayer.canvas, baseLayer.left, baseLayer.top)

  return temp
}

/**
 * レイヤーマスクを適用して、ドキュメントサイズの結果キャンバスを返す。
 *
 * ag-psd のマスクCanvasはグレースケール展開済み（R=G=B=マスク値、A=255）のため
 * destination-in は使えず、ピクセル単位でアルファにマスク値を乗算する。
 *
 * - mask.defaultColor = 0（黒）: マスク範囲外は不透明度0（非表示）
 * - mask.defaultColor = 255（白）: マスク範囲外は不透明度255（表示）
 */
export function applyLayerMask(
  layerCanvas: HTMLCanvasElement,
  layerTop: number,
  layerLeft: number,
  mask: LayerMaskData,
  docWidth: number,
  docHeight: number,
): HTMLCanvasElement {
  if (!mask.canvas || mask.disabled) return layerCanvas

  const maskTop = mask.positionRelativeToLayer
    ? layerTop + (mask.top ?? 0)
    : (mask.top ?? 0)
  const maskLeft = mask.positionRelativeToLayer
    ? layerLeft + (mask.left ?? 0)
    : (mask.left ?? 0)

  // レイヤーをドキュメント座標に配置
  const result = createCanvas(docWidth, docHeight)
  const ctx = result.getContext('2d')!
  ctx.drawImage(layerCanvas, layerLeft, layerTop)

  // マスクをドキュメント座標に配置
  // defaultColor=255（白）の場合、マスク範囲外は完全表示（白で塗りつぶし）
  const maskOnDoc = createCanvas(docWidth, docHeight)
  const maskCtx = maskOnDoc.getContext('2d')!
  if ((mask.defaultColor ?? 0) === 255) {
    maskCtx.fillStyle = '#ffffff'
    maskCtx.fillRect(0, 0, docWidth, docHeight)
  }
  maskCtx.drawImage(mask.canvas, maskLeft, maskTop)

  // ピクセル単位でアルファにマスク値（Rチャンネル）を乗算
  const resultData = ctx.getImageData(0, 0, docWidth, docHeight)
  const maskData = maskCtx.getImageData(0, 0, docWidth, docHeight)
  const rd = resultData.data
  const md = maskData.data
  for (let i = 0; i < rd.length; i += 4) {
    rd[i + 3] = Math.round((rd[i + 3] * md[i]) / 255)
  }
  ctx.putImageData(resultData, 0, 0)

  return result
}

/**
 * フォルダ内の子レイヤー群を1枚のキャンバスに合成する（グループ合成用）
 */
export function compositeGroup(
  layers: FlatLayer[],
  width: number,
  height: number
): HTMLCanvasElement {
  return compositeStack(layers, width, height, 'transparent')
}
