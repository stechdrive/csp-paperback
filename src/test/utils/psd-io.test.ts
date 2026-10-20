import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { readPsd, writePsd } from 'ag-psd'
import { readPsdFile } from '../../utils/psd-io'
import { buildLayerTree } from '../../engine/tree-builder'
import { disposeMaterials, withPreparedMaterials } from '../../engine/material-cache'

beforeEach(() => {
  const original = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag, options) => tag === 'canvas'
    ? createCanvas(1, 1) as unknown as HTMLCanvasElement : original(tag, options))
})
afterEach(() => vi.restoreAllMocks())

function fixture(compress = false, psb = false) {
  const canvas = createCanvas(2, 2), ctx = canvas.getContext('2d')
  ctx.fillStyle = '#2468ac'; ctx.fillRect(0, 0, 2, 2)
  return writePsd({ width: 2, height: 2, children: [{ name: 'ink', canvas: canvas as unknown as HTMLCanvasElement }] }, { compress, psb })
}

describe('PSD allocation preflight', () => {
  it('keeps compressed channels until requested and preserves native pixels', async () => {
    const buffer = fixture(true), lazy = readPsdFile(buffer, true), eager = readPsdFile(buffer)
    const tree = buildLayerTree(lazy)
    expect(tree[0].agPsdRef.canvas).toBeUndefined()
    expect(tree[0].agPsdRef.rawData).toBeDefined()
    try {
      await withPreparedMaterials(tree, () => {
        const data = (canvas: HTMLCanvasElement) => [...canvas.getContext('2d')!.getImageData(0, 0, 2, 2).data]
        expect(data(tree[0].agPsdRef.canvas!)).toEqual(data(eager.children![0].canvas!))
        expect(tree[0].agPsdRef.rawData).toBeDefined()
      })
    } finally { disposeMaterials(lazy) }
  })
  it.each([false, true])('keeps every decoded pixel for RLE/ZIP (compress=%s), including PSB', compress => {
    for (const psb of [false, true]) {
      const buffer = fixture(compress, psb), checked = readPsdFile(buffer), original = readPsd(buffer)
      const pixels = (canvas: HTMLCanvasElement) => [...canvas.getContext('2d')!.getImageData(0, 0, 2, 2).data]
      expect(pixels(checked.children![0].canvas!)).toEqual(pixels(original.children![0].canvas!))
      expect(checked.children![0].rawData).toBeUndefined()
    }
  })

  it('rejects a tiny file with an excessive document size before creating any canvas', () => {
    const buffer = fixture(), view = new DataView(buffer)
    view.setUint32(14, 30000); view.setUint32(18, 30000)
    const create = vi.spyOn(document, 'createElement'); create.mockClear()
    expect(() => readPsdFile(buffer)).toThrow('64メガピクセル')
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects a compressed channel whose expanded data exceeds its layer bounds', () => {
    const buffer = fixture(true), view = new DataView(buffer)
    let offset = 26
    offset += 4 + view.getUint32(offset) // color data
    offset += 4 + view.getUint32(offset) // image resources
    offset += 4 + 4 + 2 // layer/mask size, layer info size, layer count
    view.setInt32(offset + 8, 1); view.setInt32(offset + 12, 1)
    expect(() => readPsdFile(buffer)).toThrow('指定寸法を超え')
  })

  it('rejects oversized layer and mask bounds before image decoding', () => {
    const buffer = fixture(), view = new DataView(buffer)
    let offset = 26
    offset += 4 + view.getUint32(offset)
    offset += 4 + view.getUint32(offset)
    offset += 10
    view.setInt32(offset + 8, 30000); view.setInt32(offset + 12, 30000)
    const create = vi.spyOn(document, 'createElement'); create.mockClear()
    expect(() => readPsdFile(buffer)).toThrow('64メガピクセル')
    expect(create).not.toHaveBeenCalled()
  })
})
