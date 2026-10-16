import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Blob as NativeBlob } from 'node:buffer'
import { createCanvas } from '@napi-rs/canvas'
import { canvasToBlob } from '../../utils/image-export'

beforeEach(() => vi.stubGlobal('Blob', NativeBlob))
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
const output = async (blob: NativeBlob, format: 'jpg' | 'png', x = 300, y = 144) => canvasToBlob({
  toBlob: (callback: BlobCallback) => callback(blob as unknown as Blob),
} as HTMLCanvasElement, format, 0.92, x, y)
const bytes = async (blob: Blob | NativeBlob) => Buffer.from(await blob.arrayBuffer())

describe('DPI updates without copying compressed image bodies', () => {
  it('preserves every JPEG byte except the five density bytes, reading only the header', async () => {
    const input = createCanvas(40, 30).toBuffer('image/jpeg'), expected = Buffer.from(input)
    expected.set([1, 1, 44, 0, 144], 13)
    const sizes: number[] = [], original = NativeBlob.prototype.arrayBuffer
    vi.spyOn(NativeBlob.prototype, 'arrayBuffer').mockImplementation(function(this: NativeBlob) { sizes.push(this.size); return original.call(this) })
    const actual = await output(new NativeBlob([input]), 'jpg')
    expect(sizes).toEqual([18])
    expect(await bytes(actual)).toEqual(expected)
  })

  it('inserts a JFIF header when absent and leaves images without requested DPI untouched', async () => {
    const input = new NativeBlob([new Uint8Array([255, 216, 255, 219, 0, 2, 255, 217])])
    const actual = await bytes(await output(input, 'jpg'))
    expect(actual).toEqual(Buffer.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1, 1, 1, 44, 0, 144, 0, 0, 255, 219, 0, 2, 255, 217]))
    expect(await output(input, 'jpg', 0, 0)).toBe(input)
    const invalid = new NativeBlob(['invalid'])
    expect(await output(invalid, 'jpg')).toBe(invalid)
  })

  it('inserts/replaces PNG pHYs with identical pixels, chunk order, density and CRC, reading only chunk headers', async () => {
    const canvas = createCanvas(512, 512), ctx = canvas.getContext('2d'), image = ctx.createImageData(512, 512)
    let random = 12345
    for (let i = 0; i < image.data.length; i++) { random = Math.imul(random, 1664525) + 1013904223; image.data[i] = random >>> 24 }
    ctx.putImageData(image, 0, 0)
    const png = canvas.toBuffer('image/png')
    const sizes: number[] = [], original = NativeBlob.prototype.arrayBuffer
    vi.spyOn(NativeBlob.prototype, 'arrayBuffer').mockImplementation(function(this: NativeBlob) { sizes.push(this.size); return original.call(this) })
    const first = await output(new NativeBlob([png]), 'png')
    expect(sizes.every(size => size === 8)).toBe(true)
    expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThan(png.length / 100)
    const result = await bytes(first)
    expect(result.subarray(0, 33).equals(png.subarray(0, 33))).toBe(true)
    expect(result.subarray(54).equals(png.subarray(33))).toBe(true)
    expect(result.subarray(33, 54).toString('hex')).toBe('000000097048597300002e23000016250104872cd8')
    expect(result.readUInt32BE(41)).toBe(11811)
    expect(result.readUInt32BE(45)).toBe(5669)
    // Replacing an existing pHYs is byte-identical to inserting it once.
    expect((await bytes(await output(first as unknown as NativeBlob, 'png'))).equals(result)).toBe(true)
  })
})
