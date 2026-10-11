import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { Blob as NodeBlob } from 'node:buffer'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { parseClipDocument } from '../../utils/clip/parser'
import { readContainer } from '../../utils/clip/binary'
import { buildClipLayerTree } from '../../engine/clip-tree'
import { readPsd } from 'ag-psd'
import { parseXdts } from '../../utils/xdts-parser'
import { DEFAULT_PROJECT_SETTINGS, type CspLayer } from '../../types'
import type { ClipDocument } from '../../utils/clip/types'

let SQL: SqlJsStatic
let clip: ClipDocument
const all = (nodes: CspLayer[]): CspLayer[] => nodes.flatMap(n => [n, ...all(n.children)])
beforeAll(async () => {
  vi.stubGlobal('Blob', NodeBlob)
  SQL = await initSqlJs({ wasmBinary: new Uint8Array(readFileSync('node_modules/sql.js/dist/sql-wasm.wasm')).buffer })
  clip = await parseClipDocument(readFileSync('public/sample/c001.clip'), SQL, false)
})
afterAll(() => vi.unstubAllGlobals())

describe('CLIP native structure and timeline', () => {
  it('binds all c001 PSD layers and the three native cel tracks by hierarchy and identity', () => {
    const psd = readPsd(readFileSync('testdata/c001.psd'), { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true })
    const timeline = clip.timelines[0]
    const tree = buildClipLayerTree(clip, psd, timeline, DEFAULT_PROJECT_SETTINGS)
    expect(all(tree)).toHaveLength(36)
    const animation = all(tree).filter(l => l.isAnimationFolder)
    expect(animation).toHaveLength(3)
    expect(new Set(animation.map(l => l.animationFolder?.trackNo)).size).toBe(3)
    expect(timeline.diagnostics).toEqual([])
    expect(timeline.data.duration).toBe(6)
    expect(timeline.data.fps).toBe(24)
    const actual = animation.map(layer => ({
      parent: all(tree).find(l => l.id === layer.parentId)?.originalName,
      name: layer.originalName,
      frames: timeline.data.tracks.find(t => t.trackNo === layer.animationFolder?.trackNo)?.frames,
    }))
    expect(actual).toEqual([
      { parent: '演出', name: 'A', frames: [{ frameIndex: 0, cellName: '1' }, { frameIndex: 3, cellName: null }] },
      { parent: '作画', name: 'B', frames: [{ frameIndex: 0, cellName: null }, { frameIndex: 3, cellName: '1' }, { frameIndex: 120, cellName: null }] },
      { parent: '作画', name: 'A', frames: [{ frameIndex: 0, cellName: '1' }, { frameIndex: 3, cellName: null }] },
    ])
    const xdts = parseXdts(readFileSync('testdata/c001.xdts', 'utf8'))
    const held = (frames: { frameIndex: number; cellName: string | null }[], at: number) => frames.findLast(f => f.frameIndex <= at)?.cellName ?? null
    for (const native of timeline.data.tracks) {
      const reference = native.name === 'B' ? xdts.tracks.find(t => t.name === 'B')! : xdts.tracks.find(t => t.name === 'A')!
      for (let frame = 0; frame <= 120; frame++) expect(held(native.frames, frame)).toBe(held(reference.frames, frame))
    }
  })

  it('rejects renamed, reordered or flattened PSDs instead of matching duplicate names', () => {
    const source = () => readPsd(readFileSync('testdata/c001.psd'), { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true })
    const renamed = source(); renamed.children![0].name += '_changed'
    expect(() => buildClipLayerTree(clip, renamed, clip.timelines[0], DEFAULT_PROJECT_SETTINGS)).toThrow('一致しません')
    const reordered = source(); reordered.children!.reverse()
    expect(() => buildClipLayerTree(clip, reordered, clip.timelines[0], DEFAULT_PROJECT_SETTINGS)).toThrow('一致しません')
    expect(() => buildClipLayerTree(clip, { width: clip.width, height: clip.height }, clip.timelines[0], DEFAULT_PROJECT_SETTINGS)).toThrow('一致しません')
  })

  it('reads the bundled template including nine A folders and shifted motion clips', async () => {
    const template = await parseClipDocument(readFileSync('public/templates/csp-paperback-sample-template.clip'), SQL, false)
    expect(Object.keys(template.timelines[0].bindings)).toHaveLength(9)
    expect(template.timelines[0].data.tracks.every(t => t.name === 'A')).toBe(true)
    expect(template.timelines[0].diagnostics).toEqual([])
    expect(template.timelines[0].data.tracks.every(t => t.frames[0].frameIndex === 0 && t.frames[0].cellName === '1')).toBe(true)
  })

  it('recovers native raster, masks and saved text without a warning for successful recovery', async () => {
    const native = await parseClipDocument(readFileSync('public/sample/c001.clip'), SQL)
    const layers = (nodes: typeof native.layers): typeof nodes => nodes.flatMap(n => [n, ...layers(n.children)])
    expect(layers(native.layers).filter(l => l.pixels?.rgba.some(v => v > 0)).length).toBeGreaterThanOrEqual(2)
    expect(layers(native.layers).filter(l => l.mask).length, JSON.stringify(native.diagnostics)).toBe(2)
    expect(layers(native.layers).some(l => l.materialSource === 'object-cache')).toBe(true)
    expect(native.diagnostics).toEqual([])
    // Raster failures are explicit and cannot invalidate the native timeline.
    expect(native.timelines[0].diagnostics).toEqual([])
  }, 30000)

  it('rejects truncated containers and unsafe chunk lengths', () => {
    const bytes = readFileSync('public/sample/c001.clip')
    expect(() => readContainer(bytes.subarray(0, bytes.length - 7))).toThrow()
    const corrupt = Buffer.from(bytes); corrupt.writeBigUInt64BE(2n ** 63n, 32)
    expect(() => readContainer(corrupt)).toThrow()
  })
})
