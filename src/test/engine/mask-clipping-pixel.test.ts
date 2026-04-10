import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { LayerMaskData } from 'ag-psd'
import { createCanvas as createNapiCanvas } from '@napi-rs/canvas'
import { applyLayerMask, compositeStack } from '../../engine/compositor'
import type { FlatLayer } from '../../types'

let createElementSpy: ReturnType<typeof vi.spyOn>

beforeAll(() => {
  const originalCreateElement = document.createElement.bind(document)
  createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
    if (tagName.toLowerCase() === 'canvas') {
      return createNapiCanvas(300, 150) as unknown as HTMLCanvasElement
    }
    return originalCreateElement(tagName, options)
  })
})

afterAll(() => {
  createElementSpy.mockRestore()
})

function makeSolidCanvas(width: number, height: number, fillStyle: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = fillStyle
  ctx.fillRect(0, 0, width, height)
  return canvas
}

function alphaAt(canvas: HTMLCanvasElement, x: number, y: number): number {
  const ctx = canvas.getContext('2d')!
  return ctx.getImageData(x, y, 1, 1).data[3]
}

function rgbaAt(canvas: HTMLCanvasElement, x: number, y: number): [number, number, number, number] {
  const data = canvas.getContext('2d')!.getImageData(x, y, 1, 1).data
  return [data[0], data[1], data[2], data[3]]
}

function makeFlatLayer(overrides: Partial<FlatLayer> = {}): FlatLayer {
  return {
    canvas: makeSolidCanvas(2, 1, 'rgba(0, 255, 0, 1)'),
    blendMode: 'normal',
    opacity: 100,
    top: 0,
    left: 0,
    sourceId: 'layer',
    clipping: false,
    ...overrides,
  }
}

describe('applyLayerMask pixel behavior', () => {
  it('白マスクではアルファを落とさず、黒マスクでは隠す', () => {
    const layer = makeSolidCanvas(2, 1, 'rgba(255, 0, 0, 1)')
    const mask = makeSolidCanvas(2, 1, 'rgb(0, 0, 0)')
    const maskCtx = mask.getContext('2d')!
    maskCtx.fillStyle = 'rgb(255, 255, 255)'
    maskCtx.fillRect(1, 0, 1, 1)

    const result = applyLayerMask(layer, 0, 0, {
      canvas: mask,
      top: 0,
      left: 0,
      bottom: 1,
      right: 2,
      defaultColor: 0,
      disabled: false,
      positionRelativeToLayer: false,
    } satisfies LayerMaskData, 2, 1)

    expect(alphaAt(result, 0, 0)).toBe(0)
    expect(alphaAt(result, 1, 0)).toBe(255)
  })

  it('defaultColor=255 のマスク範囲外は表示したままにする', () => {
    const layer = makeSolidCanvas(2, 1, 'rgba(255, 0, 0, 1)')
    const mask = makeSolidCanvas(1, 1, 'rgb(0, 0, 0)')

    const result = applyLayerMask(layer, 0, 0, {
      canvas: mask,
      top: 0,
      left: 0,
      bottom: 1,
      right: 1,
      defaultColor: 255,
      disabled: false,
      positionRelativeToLayer: false,
    } satisfies LayerMaskData, 2, 1)

    expect(alphaAt(result, 0, 0)).toBe(0)
    expect(alphaAt(result, 1, 0)).toBe(255)
  })

  it('positionRelativeToLayer=true のマスク位置はレイヤー位置を基準にする', () => {
    const layer = makeSolidCanvas(1, 1, 'rgba(255, 0, 0, 1)')
    const mask = makeSolidCanvas(1, 1, 'rgb(255, 255, 255)')

    const result = applyLayerMask(layer, 1, 1, {
      canvas: mask,
      top: 0,
      left: 0,
      bottom: 1,
      right: 1,
      defaultColor: 0,
      disabled: false,
      positionRelativeToLayer: true,
    } satisfies LayerMaskData, 3, 3)

    expect(alphaAt(result, 0, 0)).toBe(0)
    expect(alphaAt(result, 1, 1)).toBe(255)
  })
})

describe('compositeStack clipping pixel behavior', () => {
  it('クリッピングレイヤーを直前の非クリッピングレイヤーのアルファで切り抜く', () => {
    const base = makeSolidCanvas(2, 1, 'rgba(0, 0, 0, 0)')
    const baseCtx = base.getContext('2d')!
    baseCtx.fillStyle = 'rgba(255, 0, 0, 1)'
    baseCtx.fillRect(0, 0, 1, 1)

    const clipped = makeSolidCanvas(2, 1, 'rgba(0, 255, 0, 1)')
    const result = compositeStack([
      makeFlatLayer({ sourceId: 'base', canvas: base, clipping: false }),
      makeFlatLayer({ sourceId: 'clipped', canvas: clipped, clipping: true }),
    ], 2, 1, 'transparent')

    expect(rgbaAt(result, 0, 0)).toEqual([0, 255, 0, 255])
    expect(alphaAt(result, 1, 0)).toBe(0)
  })
})
