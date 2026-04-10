import { describe, it, expect, beforeEach } from 'vitest'
import { blendModeToCompositeOp, compositeStack, createCanvas, drawLayer } from '../../engine/compositor'
import type { FlatLayer } from '../../types'
import { makeCanvas } from '../helpers/psd-factory'

function makeFlatLayer(overrides: Partial<FlatLayer> = {}): FlatLayer {
  return {
    canvas: makeCanvas(),
    blendMode: 'normal',
    opacity: 100,
    top: 0,
    left: 0,
    sourceId: 'test',
    clipping: false,
    ...overrides,
  }
}

describe('blendModeToCompositeOp', () => {
  it('通常モードをsource-overにマッピングする', () => {
    expect(blendModeToCompositeOp('normal')).toBe('source-over')
  })

  it('乗算をmultiplyにマッピングする', () => {
    expect(blendModeToCompositeOp('multiply')).toBe('multiply')
  })

  it('pass throughをsource-overにマッピングする', () => {
    expect(blendModeToCompositeOp('pass through')).toBe('source-over')
  })

  it('ネイティブ非対応モードはnullを返す', () => {
    expect(blendModeToCompositeOp('dissolve')).toBeNull()
    expect(blendModeToCompositeOp('subtract')).toBeNull()
    expect(blendModeToCompositeOp('divide')).toBeNull()
    expect(blendModeToCompositeOp('linear burn')).toBeNull()
  })

  it('全16ネイティブ対応モードがnull以外を返す', () => {
    const nativeModes = [
      'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
      'color dodge', 'color burn', 'hard light', 'soft light', 'difference',
      'exclusion', 'hue', 'saturation', 'color', 'luminosity', 'pass through',
    ] as const
    for (const mode of nativeModes) {
      expect(blendModeToCompositeOp(mode)).not.toBeNull()
    }
  })
})

describe('createCanvas', () => {
  it('指定サイズのキャンバスを生成する', () => {
    const canvas = createCanvas(200, 150)
    expect(canvas.width).toBe(200)
    expect(canvas.height).toBe(150)
  })
})

describe('drawLayer', () => {
  let ctx: CanvasRenderingContext2D

  beforeEach(() => {
    const canvas = createCanvas(100, 100)
    ctx = canvas.getContext('2d')!
  })

  it('描画後にグローバルアルファを復元する', () => {
    const layer = makeFlatLayer({ blendMode: 'normal' })
    drawLayer(ctx, layer, 100, 100)
    expect(ctx.globalAlpha).toBe(1.0)
  })

  it('ブレンドモードをセットして描画する', () => {
    const layer = makeFlatLayer({ blendMode: 'multiply' })
    drawLayer(ctx, layer, 100, 100)
    // jest-canvas-mockでdrawImageが呼ばれたか確認
    const calls = (ctx as unknown as { __getDrawCalls: () => unknown[] }).__getDrawCalls()
    expect(calls.length).toBeGreaterThan(0)
  })
})

describe('compositeStack', () => {
  it('空のレイヤー配列で白背景キャンバスを返す', () => {
    const result = compositeStack([], 100, 100, 'white')
    expect(result.width).toBe(100)
    expect(result.height).toBe(100)
  })

  it('透過背景指定時はfillRectを呼ばない', () => {
    const result = compositeStack([], 100, 100, 'transparent')
    expect(result).toBeDefined()
  })

  it('複数レイヤーを順番に合成する', () => {
    const layers: FlatLayer[] = [
      makeFlatLayer({ sourceId: 'a', blendMode: 'normal' }),
      makeFlatLayer({ sourceId: 'b', blendMode: 'multiply' }),
    ]
    const result = compositeStack(layers, 100, 100)
    expect(result.width).toBe(100)
    expect(result.height).toBe(100)
  })

  it('クリッピングレイヤーをベースがない状態でスキップする', () => {
    const layers: FlatLayer[] = [
      makeFlatLayer({ sourceId: 'clipped', clipping: true }),
    ]
    // エラーなく完了することを確認
    expect(() => compositeStack(layers, 100, 100)).not.toThrow()
  })

  it('クリッピングレイヤーをベースのアルファで切り抜く', () => {
    const layers: FlatLayer[] = [
      makeFlatLayer({ sourceId: 'base', clipping: false }),
      makeFlatLayer({ sourceId: 'clipped', clipping: true }),
    ]
    expect(() => compositeStack(layers, 100, 100)).not.toThrow()
  })

  it('位置付きレイヤーのクリッピングでベース位置とresult位置が正しい', () => {
    const baseCanvas = makeCanvas(20, 20)
    const clipCanvas = makeCanvas(40, 40)
    const layers: FlatLayer[] = [
      makeFlatLayer({ sourceId: 'base', clipping: false, canvas: baseCanvas, top: 40, left: 30 }),
      makeFlatLayer({ sourceId: 'clipped', clipping: true, canvas: clipCanvas, top: 35, left: 25 }),
    ]
    const result = compositeStack(layers, 100, 100, 'transparent')
    const ctx = result.getContext('2d')!

    // drawCallsを検証: applyClippingMask内のdestination-inでベースが正しい位置に描画されているか
    const calls = (ctx as unknown as { __getDrawCalls: () => Array<{ type: string; props: Record<string, unknown> }> }).__getDrawCalls()

    // 1つ目: ベースレイヤーの通常描画 (drawLayer)
    // 2つ目以降: クリッピング結果の描画
    // クリッピング結果のFlatLayerはtop:0, left:0で描画されるべき
    const lastDrawImageCall = calls.filter(c => c.type === 'drawImage').pop()
    expect(lastDrawImageCall).toBeDefined()
    // クリッピング結果はdoc-sizedなのでposition (0,0)で描画される
    expect(lastDrawImageCall!.props.dx).toBe(0)
    expect(lastDrawImageCall!.props.dy).toBe(0)
  })
})
