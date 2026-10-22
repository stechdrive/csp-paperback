import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { createCanvas as createNativeCanvas } from '@napi-rs/canvas'
import { blendModeToCompositeOp, compositeStack, createCanvas, drawLayer } from '../../engine/compositor'
import type { FlatLayer } from '../../types'
import { makeCanvas } from '../helpers/psd-factory'

let createElementSpy: ReturnType<typeof vi.spyOn>
beforeAll(() => {
  const original = document.createElement.bind(document)
  createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) =>
    tag.toLowerCase() === 'canvas'
      ? createNativeCanvas(300, 150) as unknown as HTMLCanvasElement
      : original(tag, options))
})
afterAll(() => createElementSpy.mockRestore())

function solidCanvas(color: string, width = 4, height = 4) {
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)
  return canvas
}

function pixel(canvas: HTMLCanvasElement, x = 0, y = 0) {
  return [...canvas.getContext('2d')!.getImageData(x, y, 1, 1).data]
}

function makeFlatLayer(overrides: Partial<FlatLayer> = {}): FlatLayer {
  return {
    canvas: solidCanvas('#ff0000'),
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

  it('ネイティブ対応モードがnull以外を返す', () => {
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

  it('レイヤーの不透明度で描画し、元のアルファと合成モードを復元する', () => {
    ctx.globalAlpha = 0.4
    ctx.globalCompositeOperation = 'screen'
    const layer = makeFlatLayer({ blendMode: 'normal', opacity: 50 })
    drawLayer(ctx, layer)
    expect(ctx.globalAlpha).toBeCloseTo(0.4)
    expect(ctx.globalCompositeOperation).toBe('screen')
    expect([...ctx.getImageData(0, 0, 1, 1).data]).toEqual([255, 0, 0, 128])
  })

  it('ブレンドモードをセットして描画する', () => {
    ctx.fillStyle = '#0000ff'
    ctx.fillRect(0, 0, 4, 4)
    const layer = makeFlatLayer({ blendMode: 'multiply' })
    drawLayer(ctx, layer)
    expect([...ctx.getImageData(0, 0, 1, 1).data]).toEqual([0, 0, 0, 255])
  })
})

describe('compositeStack', () => {
  it('空のレイヤー配列で白背景キャンバスを返す', () => {
    const result = compositeStack([], 100, 100, 'white')
    expect(result.width).toBe(100)
    expect(result.height).toBe(100)
    expect(pixel(result)).toEqual([255, 255, 255, 255])
    expect(pixel(result, 99, 99)).toEqual([255, 255, 255, 255])
  })

  it('透過背景指定時は透明な画素を返す', () => {
    const result = compositeStack([], 100, 100, 'transparent')
    expect(pixel(result)).toEqual([0, 0, 0, 0])
    expect(pixel(result, 99, 99)).toEqual([0, 0, 0, 0])
  })

  it('複数レイヤーを順番に合成する', () => {
    const layers: FlatLayer[] = [
      makeFlatLayer({ sourceId: 'a', canvas: solidCanvas('#0000ff') }),
      makeFlatLayer({ sourceId: 'b', left: 2 }),
    ]
    const result = compositeStack(layers, 8, 4, 'transparent')
    expect(pixel(result, 0)).toEqual([0, 0, 255, 255])
    expect(pixel(result, 2)).toEqual([255, 0, 0, 255])
    expect(pixel(result, 6)).toEqual([0, 0, 0, 0])
  })

  it('クリッピングレイヤーをベースがない状態でスキップする', () => {
    const layers: FlatLayer[] = [
      makeFlatLayer({ sourceId: 'clipped', clipping: true }),
    ]
    expect(pixel(compositeStack(layers, 4, 4, 'transparent'))).toEqual([0, 0, 0, 0])
  })

  it('位置付きレイヤーのクリッピングでベース位置とresult位置が正しい', () => {
    const baseCanvas = solidCanvas('#0000ff', 20, 20)
    const clipCanvas = solidCanvas('#ff0000', 40, 40)
    const layers: FlatLayer[] = [
      makeFlatLayer({ sourceId: 'base', clipping: false, canvas: baseCanvas, top: 40, left: 30 }),
      makeFlatLayer({ sourceId: 'clipped', clipping: true, canvas: clipCanvas, top: 35, left: 25 }),
    ]
    const result = compositeStack(layers, 100, 100, 'transparent')
    expect(pixel(result, 30, 40)).toEqual([255, 0, 0, 255])
    expect(pixel(result, 49, 59)).toEqual([255, 0, 0, 255])
    expect(pixel(result, 29, 40)).toEqual([0, 0, 0, 0])
    expect(pixel(result, 50, 59)).toEqual([0, 0, 0, 0])
    expect(pixel(result, 30, 39)).toEqual([0, 0, 0, 0])
    expect(pixel(result, 49, 60)).toEqual([0, 0, 0, 0])
  })
})
