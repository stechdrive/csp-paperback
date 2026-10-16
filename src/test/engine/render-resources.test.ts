import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvas as nativeCanvas } from '@napi-rs/canvas'
import { applyLayerMask, compositeStack, createCanvas } from '../../engine/compositor'
import { applyMaterialEffects } from '../../engine/material-effects'
import { withCanvasResources } from '../../engine/render-resources'
import type { LayerMaskData } from 'ag-psd'

beforeEach(() => {
  const original = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag, options) => tag === 'canvas'
    ? nativeCanvas(1, 1) as unknown as HTMLCanvasElement : original(tag, options))
})
afterEach(() => vi.restoreAllMocks())
const pixels = (c: HTMLCanvasElement) => Buffer.from(c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data)

function ink(w = 7, h = 5) {
  const c = createCanvas(w, h), ctx = c.getContext('2d')!, data = ctx.createImageData(w, h)
  for (let i = 0; i < data.data.length; i++) data.data[i] = (i * 37) % 256
  ctx.putImageData(data, 0, 0)
  return c
}

// Independent full-frame oracle for the original mask contract, including Canvas rounding.
function fullMask(source: HTMLCanvasElement, left: number, top: number, mask: LayerMaskData, w: number, h: number) {
  const out = createCanvas(w, h), ctx = out.getContext('2d')!, surface = createCanvas(w, h), mctx = surface.getContext('2d')!
  ctx.drawImage(source, left, top)
  if (mask.defaultColor === 255) { mctx.fillStyle = '#fff'; mctx.fillRect(0, 0, w, h) }
  mctx.drawImage(mask.canvas!, (mask.left ?? 0) + (mask.positionRelativeToLayer ? left : 0), (mask.top ?? 0) + (mask.positionRelativeToLayer ? top : 0))
  const data = ctx.getImageData(0, 0, w, h), values = mctx.getImageData(0, 0, w, h).data
  for (let i = 0; i < values.length; i += 4) data.data[i + 3] = Math.round(data.data[i + 3] * values[i] / 255)
  ctx.putImageData(data, 0, 0)
  return out
}

describe('render resource ownership and bounded pixel reads', () => {
  it('releases nested intermediates and exception allocations, preserving borrowed inputs and results', () => {
    const borrowed = ink(), before = pixels(borrowed), temporary: HTMLCanvasElement[] = []
    const result = withCanvasResources(() => {
      temporary.push(createCanvas(40, 30))
      const inner = withCanvasResources(() => { temporary.push(createCanvas(20, 20)); return createCanvas(15, 15) }, c => [c])
      temporary.push(inner)
      return compositeStack([{ canvas: borrowed, left: 0, top: 0, opacity: 100, blendMode: 'normal', sourceId: 'ink', clipping: false }], 40, 30, 'transparent')
    }, c => [c])
    expect(temporary.every(c => c.width === 1 && c.height === 1)).toBe(true)
    expect(result.width).toBe(40)
    expect(pixels(borrowed)).toEqual(before)
    let failed!: HTMLCanvasElement
    expect(() => withCanvasResources(() => { failed = createCanvas(50, 50); throw Error('failed') }, () => [])).toThrow('failed')
    expect(failed.width * failed.height).toBe(1)
  })

  it.each([0, 255])('matches full-frame masking with defaultColor=%i, fractional/negative/off-canvas origins and relative masks', defaultColor => {
    const source = ink(), maskCanvas = ink(6, 4)
    for (const [left, top] of [[4, 5], [-2.25, 1.75], [18.5, 13.5], [-30, -30]]) {
      for (const relative of [false, true]) for (const [maskLeft, maskTop] of [[-1.25, 2.5], [1, 2]]) {
        const mask = { canvas: maskCanvas, left: maskLeft, top: maskTop, defaultColor, positionRelativeToLayer: relative }
        const actual = applyLayerMask(source, top, left, mask, 23, 17)
        expect(pixels(actual), JSON.stringify({ left, top, relative, defaultColor })).toEqual(pixels(fullMask(source, left, top, mask, 23, 17)))
      }
    }
    expect(applyLayerMask(source, 0, 0, { canvas: maskCanvas, disabled: true }, 23, 17)).toBe(source)
  })

  it('propagates conservative bounds through groups and effects without clipping fractional edges', () => {
    const source = ink(), effects = { layerColor: { main: [30, 90, 180] as [number, number, number], sub: [180, 200, 20] as [number, number, number] }, edge: { radius: 2.7, color: [0, 10, 20] as [number, number, number] } }
    for (const [left, top] of [[4.25, 5.75], [-2.5, -1.5], [25.5, 21.5]]) {
      const grouped = compositeStack([{ canvas: source, left, top, blendMode: 'normal', opacity: 75, sourceId: 'ink', clipping: false }], 31, 27, 'transparent')
      const full = createCanvas(31, 27); full.getContext('2d')!.drawImage(grouped, 0, 0)
      const actual = applyMaterialEffects(grouped, 0, 0, effects, 31, 27)
      const reference = applyMaterialEffects(full, 0, 0, effects, 31, 27)
      expect(pixels(actual)).toEqual(pixels(reference))
      const mask = { canvas: ink(), defaultColor: 255, left: 4, top: 2 }
      expect(pixels(applyLayerMask(actual, 0, 0, mask, 31, 27))).toEqual(pixels(fullMask(reference, 0, 0, mask, 31, 27)))
    }
  })
})
