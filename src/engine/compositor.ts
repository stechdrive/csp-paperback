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
  let baseCanvas: HTMLCanvasElement | null = null
  let baseIndex = -1

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]

    if (!layer.clipping) {
      // 通常レイヤー: そのまま合成してベースとして記録
      drawLayer(ctx, layer, width, height)
      baseCanvas = layer.canvas
      baseIndex = i
    } else {
      // クリッピングレイヤー: ベースのアルファで切り抜いてから合成
      if (baseCanvas === null) {
        // ベースがない場合はスキップ
        continue
      }
      const clipped = applyClippingMask(layer, baseCanvas, width, height)
      const clippedFlat: FlatLayer = { ...layer, canvas: clipped, clipping: false }
      drawLayer(ctx, clippedFlat, width, height)
      void baseIndex // suppress unused warning
    }
  }

  return output
}

/**
 * 単一レイヤーをコンテキストに描画
 */
export function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: FlatLayer,
  _width: number,
  _height: number
): void {
  const compositeOp = blendModeToCompositeOp(layer.blendMode)

  if (compositeOp !== null) {
    ctx.save()
    ctx.globalCompositeOperation = compositeOp
    ctx.globalAlpha = 1.0 // 不透明度は常に100%
    ctx.drawImage(layer.canvas, layer.left, layer.top)
    ctx.restore()
  } else {
    // ソフトウェアフォールバック（v1では未実装、通常合成で代替）
    // TODO: v1.1でPDF Reference 1.7準拠のピクセル演算を実装
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1.0
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
  baseCanvas: HTMLCanvasElement,
  width: number,
  height: number
): HTMLCanvasElement {
  const temp = createCanvas(width, height)
  const tempCtx = temp.getContext('2d')!

  // クリッピングレイヤーを描画
  tempCtx.drawImage(clippingLayer.canvas, clippingLayer.left, clippingLayer.top)

  // ベースレイヤーのアルファで切り抜き（destination-in）
  tempCtx.globalCompositeOperation = 'destination-in'
  tempCtx.drawImage(baseCanvas, 0, 0)

  return temp
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
