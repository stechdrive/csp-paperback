import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { readPsd } from 'ag-psd'
import { openClipSession } from '../../utils/clip/parser'
import { readContainer } from '../../utils/clip/binary'
import { hasLayerMask, readLayerKind, readPaletteColor } from '../../utils/clip/layer-metadata'
import { readGradientKind } from '../../utils/clip/gradient'
import { buildClipLayerTree } from '../../engine/clip-tree'
import { DEFAULT_PROJECT_SETTINGS, type CspLayer } from '../../types'
import type { ClipLayer } from '../../utils/clip/types'

let SQL: SqlJsStatic
beforeAll(async () => { SQL = await initSqlJs({ wasmBinary: new Uint8Array(readFileSync('node_modules/sql.js/dist/sql-wasm.wasm')).buffer }) })
const flatten = <T extends { children: T[] }>(nodes: T[]): T[] => nodes.flatMap(node => [node, ...flatten(node.children)])

describe('CLIP layer identification before pixel decoding', () => {
  it('reads paper, fill, palette and mask metadata from the native sample without requesting pixels', async () => {
    const { document: doc } = await openClipSession(readFileSync('public/sample/c001.clip'), SQL)
    const layers = flatten<ClipLayer>(doc.layers)
    const paper = layers.find(layer => layer.name === '用紙')!
    expect(paper.kind).toBe('paper')
    expect(paper.effects?.layerColor).toBeUndefined()
    const fills = layers.filter(layer => ['演出修正用紙', '作監修正用紙'].includes(layer.name))
    expect(fills).toHaveLength(2)
    expect(fills.every(layer => layer.kind === 'fill' && layer.maskState === 'enabled')).toBe(true)
    expect(layers.some(layer => layer.paletteColor === '#ffd0d0')).toBe(true)
    expect(layers.some(layer => layer.paletteColor === '#ffffb4')).toBe(true)
    expect(layers.every(layer => !layer.pixels && !layer.mask)).toBe(true)
    const psd = readPsd(readFileSync('testdata/c001.psd'), { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true })
    const tree = flatten<CspLayer>(buildClipLayerTree(doc, psd, doc.timelines[0], DEFAULT_PROJECT_SETTINGS))
    for (const native of layers) {
      const paired = tree.find(layer => layer.id === `clip:${native.id}`)!
      expect(paired.display).toEqual({ kind: native.kind, paletteColor: native.paletteColor, effects: native.effects, mask: native.maskState })
      expect(paired.materialEffects).toBeUndefined()
    }
  })

  it('distinguishes flat fills from gradient settings and tolerates damaged display hints', () => {
    const db = new SQL.Database(readContainer(readFileSync('public/sample/c001.clip')).database)
    try {
      const bytes = Buffer.from(db.exec("SELECT GradationFillInfo FROM Layer WHERE LayerName='演出修正用紙'")[0].values[0][0] as Uint8Array)
      expect(readGradientKind(bytes)).toBe('fill')
      const name = Buffer.from('GradationSettingAdd0001', 'utf16le').swap16()
      const flag = bytes.indexOf(name) + name.length + 4
      bytes.writeUInt32BE(0, flag)
      expect(readGradientKind(bytes)).toBe('gradient')
      expect(readLayerKind({ GradationFillInfo: new Uint8Array(bytes), LayerType: 2 })).toBe('gradient')
      expect(readGradientKind(bytes.subarray(0, flag + 2))).toBeUndefined()
      expect(readLayerKind({ GradationFillInfo: new Uint8Array([1, 2]), LayerType: 2 })).toBe('other')
    } finally { db.close() }
  })

  it('keeps paper separate from cameras, and classifies native artwork independently of names', () => {
    expect(readLayerKind({ LayerType: 1586, DrawColorEnable: 1 })).toBe('paper')
    expect(readLayerKind({ LayerType: 512, LayerFolder: 1 })).toBe('camera')
    expect(readLayerKind({ LayerName: '用紙', LayerType: 1 })).toBe('raster')
    expect(readLayerKind({ ResizableImageInfo: new Uint8Array([1]), LayerType: 0 })).toBe('image-material')
    expect(readLayerKind({ Manager3DOd: 1 })).toBe('3d')
    expect(readLayerKind({ VectorNormalStrokeIndex: 1 })).toBe('vector')
    expect(readLayerKind({}, true)).toBe('vector')
  })

  it('validates label colors and keeps them independent of drawing color', () => {
    const fields = { LayerUsePaletteColor: 1, LayerPaletteRed: 0xffffffff, LayerPaletteGreen: 0x80808080, LayerPaletteBlue: 0 }
    expect(readPaletteColor(fields)).toBe('#ff8000')
    expect(readPaletteColor({ ...fields, LayerUsePaletteColor: 0 })).toBeUndefined()
    expect(readPaletteColor({ ...fields, LayerPaletteGreen: -1 })).toBeUndefined()
    expect(readPaletteColor({ ...fields, LayerPaletteBlue: null })).toBeUndefined()
    expect(readPaletteColor({ DrawColorEnable: 1, DrawColorMainBlue: 0xffffffff })).toBeUndefined()
  })

  it('recognizes original raster and mask references after keyframing clears the type bits', () => {
    expect(readLayerKind({ LayerType: 0, TimeLineOriginalMipmap: 7 })).toBe('raster')
    expect(readLayerKind({ LayerFolder: 1, TimeLineOriginalMipmap: 7 })).toBe('folder')
    expect(readLayerKind({ TextLayerString: 'X', TimeLineOriginalMipmap: 7 })).toBe('text')
    expect(readLayerKind({ Manager3D: 1, TimeLineOriginalMipmap: 7 })).toBe('3d')
    expect(hasLayerMask({ LayerType: 0, TimeLineOriginalMaskMipmap: 8, LayerVisibility: 1 })).toBe(true)
    expect(hasLayerMask({ LayerType: 2 })).toBe(true)
    expect(hasLayerMask({ LayerType: 0, LayerLayerMaskMipmap: 8, TimeLineLayerKeyFrameEnabled: 1 })).toBe(true)
    expect(hasLayerMask({ LayerType: 0, TimeLineOriginalMaskMipmap: 0 })).toBe(false)
  })
})
