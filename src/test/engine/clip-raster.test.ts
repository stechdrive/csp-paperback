import { afterEach, describe, expect, it, vi } from 'vitest'
import { Blob as NodeBlob } from 'node:buffer'
import { readAttribute, readRaster } from '../../utils/clip/raster'
import { cropPixels } from '../../utils/clip/pixels'
import { rasterFixture } from '../fixtures/clip-raster'

afterEach(() => vi.unstubAllGlobals())

describe('bounded raster expansion', () => {
  it.each([0, 1, 2, 4])('preserves channel format %i across tile and canvas edges', async channels => {
    vi.stubGlobal('Blob', NodeBlob)
    for (const bitDepth of channels === 1 ? [1, 5] : [5]) {
      const planeBytes = bitDepth === 1 ? 8192 : 65536
      const raw = new Uint8Array(channels === 4 ? 327680 : channels === 0 ? 65536 : planeBytes * 2)
      for (let i = 0; i < raw.length; i++) raw[i] = (i * 31 + (i >>> 7)) % 256
      const { a, body, attribute } = rasterFixture(513, 269, new Map([[4, raw], [5, raw]]), { channels, bitDepth, planeBytes })
      expect(readAttribute(attribute)).toEqual(a)
      for (const mask of [false, true]) {
        const full = (await readRaster(a, body, mask))!
        const cropped = (await readRaster(a, body, mask, true))!
        expect(cropped).toEqual(cropPixels(full, mask))
        expect(cropped.left).toBeGreaterThanOrEqual(256)
        expect(cropped.top).toBeGreaterThanOrEqual(256)
      }
    }
  })

  it.each([false, true])('retains initial colors and mask defaults (mask=%s)', async mask => {
    vi.stubGlobal('Blob', NodeBlob)
    for (const hasColor of [false, true]) for (const color of [0, 0xffffff00, 128, 255]) {
      const raw = new Uint8Array(65536).fill(200)
      raw[3] = 0
      const { a, body } = rasterFixture(520, 270, new Map([[4, raw]]), { hasColor, color })
      expect(await readRaster(a, body, mask, true)).toEqual(cropPixels((await readRaster(a, body, mask))!, mask))
    }
  })

  it('keeps full original extent on request and uses an origin placeholder for empty offscreens', async () => {
    vi.stubGlobal('Blob', NodeBlob)
    const { a, body } = rasterFixture(513, 260, new Map([[5, new Uint8Array(65536)]]))
    const empty = (await readRaster(a, body, false, true))!
    expect(empty).toMatchObject({ left: 0, top: 0, width: 1, height: 1 })
    expect([...empty.rgba]).toEqual([0, 0, 0, 0])
    expect(await readRaster(a, body, false)).toMatchObject({ left: 0, top: 0, width: 513, height: 260 })
    expect(await readRaster(a, undefined, false, true)).toBeUndefined()
    expect(await readRaster({ ...a, hasColor: true, color: 255 }, undefined, true, true))
      .toMatchObject({ left: 0, top: 0, width: 1, height: 1, defaultColor: 255, rgba: new Uint8ClampedArray([255, 255, 255, 255]) })
  })

  it('validates empty and off-canvas tiles as well as compressed lengths', async () => {
    vi.stubGlobal('Blob', NodeBlob)
    const fixture = rasterFixture(1, 1, new Map([[1, new Uint8Array(10)]]), { cols: 2 })
    await expect(readRaster(fixture.a, fixture.body, false, true)).rejects.toThrow('タイル形式')
    const { a, body } = rasterFixture(512, 256, new Map())
    body[body.length - 1] ^= 1
    await expect(readRaster(a, body, false, true)).rejects.toThrow('終端')
    await expect(readRaster(a, body.subarray(0, 50), false, true)).rejects.toThrow('切れ')
  })

  it('allocates only the occupied tile before cropping a 4K offscreen', async () => {
    vi.stubGlobal('Blob', NodeBlob)
    const raw = new Uint8Array(65536); raw[11 * 256 + 7] = 192
    const { a, body } = rasterFixture(4096, 4096, new Map([[83, raw]]))
    const allocations: number[] = []
    vi.stubGlobal('Uint8ClampedArray', new Proxy(Uint8ClampedArray, { construct(target, args) {
      const array = Reflect.construct(target, args) as Uint8ClampedArray
      allocations.push(array.byteLength); return array
    } }))
    const result = await readRaster(a, body, false, true)
    expect(result).toMatchObject({ left: 775, top: 1291, width: 1, height: 1, rgba: new Uint8ClampedArray([255, 255, 255, 192]) })
    expect(Math.max(...allocations)).toBe(256 * 256 * 4)
  })
})
