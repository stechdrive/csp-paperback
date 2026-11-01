import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { createCanvas } from '@napi-rs/canvas'
import { readAdjustment } from 'celcodec/material'
import { drawAdjustment } from '../../engine/material-adjustment'
import goldens from '../fixtures/native-adjustment-goldens.json'

let spy: ReturnType<typeof vi.spyOn>
beforeAll(() => {
  const create = document.createElement.bind(document)
  spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) =>
    tag === 'canvas' ? createCanvas(1, 1) as unknown as HTMLCanvasElement : create(tag, options))
})
afterAll(() => spy.mockRestore())

describe('CSP adjustment captures through the Paperback Canvas adapter', () => {
  for (const source of goldens.sources) for (const capture of source.cases) {
    it(`${source.corpus} ${capture.name}: opaque color ramps`, () => {
      const expected = inflateSync(Buffer.from(capture.expectedDeflateBase64, 'base64'))
      expect(createHash('sha256').update(expected).digest('hex')).toBe(capture.expectedSha256)
      const canvas = document.createElement('canvas'), mask = document.createElement('canvas')
      canvas.width = mask.width = 256; canvas.height = mask.height = 3
      const ctx = canvas.getContext('2d')!, image = ctx.createImageData(256, 3)
      // First three bands of the native capture. The fourth (alpha 128) is tested
      // by celcodec without Canvas premultiplication; existing app tests cover masks/opacity.
      for (let row = 0; row < 3; row++) for (let x = 0; x < 256; x++) image.data.set(
        row === 0 ? [x, x, x, 255] : row === 1 ? [x, 0, 255 - x, 255]
          : [x * 17 % 256, x * 47 % 256, x * 113 % 256, 255], (row * 256 + x) * 4)
      ctx.putImageData(image, 0, 0)
      const maskCtx = mask.getContext('2d')!
      maskCtx.fillStyle = '#fff'; maskCtx.fillRect(0, 0, 256, 3)
      const adjustment = readAdjustment(new Uint8Array(Buffer.from(capture.filterBase64, 'base64')))
      drawAdjustment(ctx, { sourceId: 'native-adjustment', canvas: mask, left: 0, top: 0, opacity: 100, blendMode: 'normal', clipping: false, adjustment })
      const actual = ctx.getImageData(0, 0, 256, 3).data
      let peak = 0, sum = 0
      for (let i = 0; i < actual.length; i += 4) {
        expect(actual[i + 3]).toBe(expected[i + 3])
        for (let c = 0; c < 3; c++) {
          const delta = Math.abs(actual[i + c] - expected[i + c])
          peak = Math.max(peak, delta); sum += delta
        }
      }
      // These bounds are the native capture's published tolerances, unchanged.
      expect(peak).toBeLessThanOrEqual(adjustment.kind === 'hue-saturation-lightness' ? 4 : 1)
      expect(sum / (256 * 3 * 3)).toBeLessThan(0.8)
    })
  }
})
