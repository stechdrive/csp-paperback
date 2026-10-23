import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Blob as NodeBlob } from 'node:buffer'
import { createCanvas } from '@napi-rs/canvas'
import { rasterFixture } from '../fixtures/clip-raster'
import { createMaterialDecoder, type MaterialTables } from '../../utils/clip/material'
import { readTextObjects } from '../../utils/clip/text'
import { readLayerKind } from '../../utils/clip/layer-metadata'
import { renderClipMaterial } from '../../engine/material-image'
import { buildClipLayerTree, clipRenderingSource } from '../../engine/clip-tree'
import { flattenToCanvas } from '../../engine/flatten'
import { DEFAULT_PROJECT_SETTINGS } from '../../types'
import type { MaterialQuad } from '../../types/rendering'
import type { ClipRow } from '../../utils/clip/records'
import type { ClipDiagnostic, ClipDocument, ClipLayer } from '../../utils/clip/types'

const createElement = document.createElement.bind(document)
beforeAll(() => {
  vi.stubGlobal('Blob', NodeBlob)
  document.createElement = ((tag: string) => tag === 'canvas' ? createCanvas(1, 1) : createElement(tag)) as typeof document.createElement
})
afterAll(() => { document.createElement = createElement; vi.unstubAllGlobals() })
const tables = (): MaterialTables => ({ mipmaps: new Map(), mipInfos: new Map(), offscreens: new Map(), thumbnails: [], external: new Map() })
const layer = (row: ClipRow, id = 'art'): ClipLayer => ({ id, name: id, kind: readLayerKind(row), isFolder: !!row.LayerFolder,
  isAnimationFolder: false, expanded: true, hidden: false, opacity: 1, blendMode: 'normal', clipping: false, children: [] })
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b }
const ints = (...values: number[]) => { const b = Buffer.alloc(values.length * 4); values.forEach((v, i) => b.writeInt32LE(v, i * 4)); return b }
const tlv = (id: number, b: Uint8Array) => Buffer.concat([ints(id, b.length), b])
const wide = (s: string) => Buffer.concat([u32(s.length), Buffer.from(s, 'utf16le').swap16()])
const quadInfo = (q: MaterialQuad) => {
  const b = Buffer.alloc(184); b.writeUInt32BE(120)
  ;[...q.slice(0, 4), ...q.slice(6), ...q.slice(4, 6)].forEach((v, i) => b.writeDoubleBE(v, 120 + i * 8))
  return new Uint8Array(b)
}
function install(t: MaterialTables, id: number, fixture: ReturnType<typeof rasterFixture>, mipmap = true, layerId = 99) {
  t.offscreens.set(id, { MainId: id, LayerId: layerId, Attribute: new Uint8Array(fixture.attribute), BlockData: String(id) })
  t.external.set(String(id), new Uint8Array(fixture.body))
  if (mipmap) {
    t.mipmaps.set(id, { BaseMipmapInfo: id })
    t.mipInfos.set(id, { ThisScale: 100, Offscreen: id })
  }
}
function dot(t: MaterialTables, id: number, x = 20, y = 17, mask = false, mipmap = true, width = 64, height = 64) {
  const raw = new Uint8Array(65536).fill(mask ? 255 : 0)
  raw[y * 256 + x] = mask ? 128 : 255
  install(t, id, rasterFixture(width, height, new Map([[0, raw]]), { hasColor: mask, color: mask ? 255 : 0 }), mipmap)
}
async function decode(t: MaterialTables, fields: ClipRow) {
  const row = { MainId: 99, LayerType: 1, LayerVisibility: 3, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, Buffer.isBuffer(v) ? new Uint8Array(v) : v])) }
  const art = layer(row), diagnostics: ClipDiagnostic[] = []
  await createMaterialDecoder(t, 640, 480, 72, diagnostics)(art, row)
  return { art, diagnostics }
}
const pixels = (c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data

describe('CLIP material coordinate spaces', () => {
  it.each([
    [30, 30, 94, 30, 94, 94, 30, 94],
    [55, 15, 95, 55, 55, 95, 15, 55],
    [30, 20, 95, 30, 80, 96, 15, 80],
    [94, 30, 30, 30, 30, 94, 94, 94],
  ])('translates the entire original image quad once: %j', async (...corners) => {
    const t = tables(); dot(t, 1)
    const row = { ResizableOriginalMipmap: 1, ResizableImageInfo: quadInfo(corners as MaterialQuad) }
    const base = (await decode(t, row)).art
    const moved = (await decode(t, { ...row, LayerOffsetX: -45, LayerOffsetY: 21 })).art
    expect([moved.pixels!.width, moved.pixels!.height]).toEqual([64, 64]) // transparent original extent is part of the transform
    const a = renderClipMaterial(base, 640, 480)!, b = renderClipMaterial(moved, 640, 480)!
    expect([b.left - a.left, b.top - a.top]).toEqual([-45, 21])
    expect(pixels(b.canvas)).toEqual(pixels(a.canvas))
  })

  it.each(['raster', 'text', 'vector', 'image-material', 'gradient', '3d'] as const)('keeps saved %s images in render space', async kind => {
    const t = tables(); dot(t, 1)
    const art = { ...layer({}), kind }, diagnostics: ClipDiagnostic[] = []
    await createMaterialDecoder(t, 640, 480, 72, diagnostics)(art, { LayerRenderMipmap: 1, LayerOffsetX: 7, LayerOffsetY: -5,
      LayerRenderOffscrOffsetX: 3, LayerRenderOffscrOffsetY: 2, ResizableImageInfo: quadInfo([0, 0, 64, 0, 64, 64, 0, 64]) })
    expect(art.materialSource).toBe('render')
    expect([art.pixels!.left, art.pixels!.top]).toEqual([30, 14])
    expect(art.placement).toBeUndefined()
  })

  it('uses original image and mask offsets independently of the saved shooting render', async () => {
    const t = tables(); dot(t, 1); dot(t, 2, 20, 17, true); dot(t, 3, 50, 50); dot(t, 4, 50, 50, true)
    const { art, diagnostics } = await decode(t, { LayerType: 0, TimeLineOriginalMipmap: 1, TimeLineOriginalMaskMipmap: 2,
      LayerRenderMipmap: 3, LayerLayerMaskMipmap: 4, LayerOffsetX: -30, LayerOffsetY: 45,
      LayerRenderOffscrOffsetX: 100, LayerRenderOffscrOffsetY: 100, TimeLineRenderOriginalOffsetX: 30, TimeLineRenderOriginalOffsetY: -45,
      LayerMaskOffsetX: 90, LayerMaskOffsetY: -75, TimeLineMaskOriginalOffsetX: -60, TimeLineMaskOriginalOffsetY: 30,
      LayerMaskOffscrOffsetX: 100, LayerMaskOffscrOffsetY: 100 })
    expect(art.kind).toBe('raster')
    expect(art.materialSource).toBe('timeline-original')
    expect([art.pixels!.left, art.pixels!.top]).toEqual([20, 17])
    expect([art.mask!.left, art.mask!.top, art.mask!.defaultColor]).toEqual([20, 17, 255])
    expect(diagnostics).toEqual([])
  })

  it.each([0, 1])('keeps a moved original folder mask with disabled=%i', async disabled => {
    const t = tables(); dot(t, 1, 20, 17, true)
    const { art } = await decode(t, { LayerFolder: 1, LayerType: 0, TimeLineOriginalMaskMipmap: 1,
      LayerOffsetX: -10, LayerOffsetY: 4, LayerMaskOffsetX: 8, LayerMaskOffsetY: -2,
      TimeLineMaskOriginalOffsetX: -3, TimeLineMaskOriginalOffsetY: 6, LayerVisibility: disabled ? 1 : 3 })
    expect([art.mask!.left, art.mask!.top, art.mask!.disabled]).toEqual([15, 25, !!disabled])
    const fill = await decode(tables(), { LayerType: 1584, DrawColorEnable: 1, DrawColorMainRed: 0xffffffff })
    art.children = [fill.art]
    const doc: ClipDocument = { width: 640, height: 480, dpi: 72, layers: [art], timelines: [], defaultTimelineId: null, diagnostics: [] }
    const result = flattenToCanvas(buildClipLayerTree(doc, clipRenderingSource(doc), undefined, DEFAULT_PROJECT_SETTINGS, false), 640, 480, 'transparent')
    expect([...result.getContext('2d')!.getImageData(15, 25, 1, 1).data]).toEqual([255, 0, 0, disabled ? 255 : 128])
    expect([...result.getContext('2d')!.getImageData(0, 0, 1, 1).data]).toEqual([255, 0, 0, 255])
  })

  it.each(['missing', 'corrupt', 'reference-missing'] as const)('does not use a shooting render when the original is %s', async failure => {
    const t = tables(); dot(t, 2)
    if (failure === 'corrupt') { dot(t, 1); t.external.set('1', new Uint8Array([1])) }
    const { art, diagnostics } = await decode(t, { TimeLineLayerKeyFrameEnabled: 1, TimeLineOriginalMipmap: failure === 'reference-missing' ? 0 : 1, LayerRenderMipmap: 2 })
    expect(art.pixels).toBeUndefined()
    expect(diagnostics.some(d => d.part === 'material' && d.outcome === 'missing-content')).toBe(true)
  })

  it('does not mix the original image with a shooting mask when the original mask is unavailable', async () => {
    const t = tables(); dot(t, 1); dot(t, 2, 20, 17, true)
    for (const original of [0, 999]) {
      const { art, diagnostics } = await decode(t, { LayerType: 3, TimeLineOriginalMipmap: 1, TimeLineOriginalMaskMipmap: original, LayerLayerMaskMipmap: 2 })
      expect(art.materialSource).toBe('timeline-original')
      expect(art.mask).toBeUndefined()
      expect(diagnostics.some(d => d.part === 'mask' && d.outcome === 'missing-effect')).toBe(true)
    }
  })

  it('reports an unavailable original folder mask even when its ordinary type bit was cleared', async () => {
    const t = tables(); dot(t, 2, 20, 17, true)
    const { art, diagnostics } = await decode(t, { LayerType: 0, LayerFolder: 1, TimeLineLayerKeyFrameEnabled: 1, LayerLayerMaskMipmap: 2 })
    expect(art.mask).toBeUndefined()
    expect(diagnostics.some(d => d.part === 'mask' && d.outcome === 'missing-effect')).toBe(true)
  })
})

describe('CLIP cached text placement', () => {
  // CSP save pairs: horizontal, vertical, +45 degrees, and scaled / -27.2 degrees.
  const cases = [
    { box: [65, 75, 419, 155], quad: [0, 400, 35400, 400, 35400, 8400, 0, 8400], offset: [0, -4], origin: [65, 75], size: [355, 85] },
    { box: [604, 75, 641, 309], quad: [-3600, 0, 100, 0, 100, 23400, -3600, 23400], offset: [36, 0], origin: [604, 75], size: [38, 235] },
    { box: [117, 195, 471, 275], quad: [-283, 282, 24746, 25316, 19089, 30972, -5941, 5939], offset: [63, -3], origin: [137, 82], size: [311, 310] },
    { box: [113, 206, 526, 298], quad: [228, 444, 36955, -18445, 41163, -10264, 4436, 8626], offset: [-2, 185], origin: [115, 117], size: [412, 276] },
    // Exact integer boundary at negative coordinates; floating point division before ceil adds a pixel.
    { box: [-100, 0, 50, 63], quad: [-17977, 0, 12777, 0, 12777, 6300, -17977, 6300], offset: [180, 0], origin: [-179, 0], size: [309, 64] },
  ]
  it.each(cases)('places cache metadata at $origin without applying the transform twice', async c => {
    const t = tables(); dot(t, 23, 20, 17, false, false, c.size[0], c.size[1])
    const attrs = Buffer.concat([tlv(42, ints(...c.box)), tlv(50, ints(23)), tlv(64, ints(...c.quad)), tlv(72, ints(...c.offset))])
    const { art, diagnostics } = await decode(t, { TextLayerString: 'X', TextLayerAttributes: attrs, LayerOffsetX: -7, LayerOffsetY: 9 })
    expect(art.materialSource).toBe('object-cache')
    expect([art.pixels!.left, art.pixels!.top]).toEqual([c.origin[0] + 13, c.origin[1] + 26])
    expect(art.text).toBeUndefined()
    expect(diagnostics).toEqual([])
  })

  it('uses each object reference even when several different caches have the same dimensions', async () => {
    const t = tables(); dot(t, 23, 10, 10, false, false); dot(t, 24, 30, 30, false, false)
    const attrs = (id: number, x: number) => Buffer.concat([tlv(42, ints(x, 0, x + 63, 63)), tlv(50, ints(id))])
    const second = attrs(24, 100)
    const { art } = await decode(t, { TextLayerString: 'A', TextLayerAttributes: attrs(23, 0),
      TextLayerStringArray: Buffer.concat([ints(1), Buffer.from('B')]), TextLayerAttributesArray: Buffer.concat([ints(second.length), second]) })
    expect(art.materialSource).toBe('object-cache')
    expect(art.fragments?.map(p => [p.left, p.top])).toEqual([[10, 10], [130, 30]])
  })

  it('does not substitute a same-sized unrelated cache for a missing reference', async () => {
    const t = tables(); dot(t, 24, 30, 30, false, false)
    const { art, diagnostics } = await decode(t, { TextLayerString: 'A', TextLayerAttributes: Buffer.concat([tlv(42, ints(0, 0, 63, 63)), tlv(50, ints(23))]) })
    expect(art.materialSource).toBe('text')
    expect(art.pixels).toBeUndefined()
    expect(diagnostics.some(d => d.materialKind === 'text')).toBe(true)
    expect(readTextObjects({ TextLayerString: 'A', TextLayerAttributes: new Uint8Array(tlv(50, ints(23))) }, 72)[0].cache).toBeUndefined()
  })
})

describe('CLIP paper and flat fill recovery', () => {
  it.each([[255, 255, 255], [24, 120, 210]])('uses paper color %j even with a black cached InitColor', async (...rgb) => {
    const t = tables()
    install(t, 1, rasterFixture(8, 4, new Map(), { hasColor: true, color: 0xffffffff, channels: 4, rgb: [0, 0, 0] }))
    const { art } = await decode(t, { LayerType: 1584, LayerRenderMipmap: 1, DrawColorEnable: 1,
      DrawColorMainRed: rgb[0] * 0x01010101, DrawColorMainGreen: rgb[1] * 0x01010101, DrawColorMainBlue: rgb[2] * 0x01010101 })
    expect([...art.pixels!.rgba.slice(0, 4)]).toEqual([...rgb, 255])
    expect(art.effects?.layerColor).toBeUndefined()
    const raster = (await decode(t, { LayerRenderMipmap: 1 })).art
    expect([...raster.pixels!.rgba.slice(0, 4)]).toEqual([0, 0, 0, 255])
  })

  it('restores a keyframed flat fill without decoding its inactive gradient stop list', async () => {
    const unused = new Uint8Array([1, 2, 3]), flat = Buffer.concat([u32(1), u32(0xff000000), u32(0x80000000), u32(0)])
    const data = Buffer.concat([Buffer.alloc(8), wide('GradationData'), u32(unused.length), unused, wide('GradationSettingAdd0001'), u32(flat.length), flat])
    const { art, diagnostics } = await decode(tables(), { LayerType: 0, GradationFillInfo: data, TimeLineLayerKeyFrameEnabled: 1 })
    expect([...art.pixels!.rgba.slice(0, 4)]).toEqual([255, 128, 0, 255])
    expect(diagnostics).toEqual([])
  })
})
