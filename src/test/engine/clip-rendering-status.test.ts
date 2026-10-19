import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import initSqlJs from 'sql.js'
import { layerRenderingDiagnostics, resolveClipDiagnostics } from '../../utils/clip/rendering-status'
import { parseClipDocument } from '../../utils/clip/parser'
import { buildClipLayerTree, clipRenderingSource } from '../../engine/clip-tree'
import { DEFAULT_PROJECT_SETTINGS, DEFAULT_OUTPUT_CONFIG } from '../../types'
import type { ClipDocument, ClipLayer } from '../../utils/clip/types'
import { trackExportDiagnostics } from '../../utils/export-diagnostics'
import { recordComposite } from '../../engine/render-sources'

const layer = (extra: Partial<ClipLayer> = {}): ClipLayer => ({ id: 'art', name: 'art', isFolder: false, isAnimationFolder: false,
  hidden: false, expanded: true, opacity: 1, blendMode: 'normal', clipping: false, children: [], ...extra })
const doc = (layers: ClipLayer[]): ClipDocument => ({ width: 8, height: 8, dpi: 72, layers, timelines: [], defaultTimelineId: null, diagnostics: [] })

it.each(['saved', 'not-saved', 'unknown'] as const)('uses actual image recovery before compatibility=%s to decide guidance', compatibility => {
  for (const kind of ['vector', '3d', 'text'] as const) {
    expect(layerRenderingDiagnostics(layer({ kind, materialSource: 'render' }), compatibility)).toEqual([])
  }
  expect(layerRenderingDiagnostics(layer({ kind: 'text', materialSource: 'object-cache' }), compatibility)).toEqual([])
  const [vector] = layerRenderingDiagnostics(layer({ kind: 'vector', vectorRendering: 'approximate' }), compatibility)
  expect(vector.outcome).toBe('approximate')
  expect(vector.message.includes('［保存する］')).toBe(compatibility !== 'saved')
  const [missing] = layerRenderingDiagnostics(layer({ kind: '3d', unsupported3D: true }), compatibility)
  expect(missing.outcome).toBe('missing-content')
  expect(missing.message).toContain('透明な画像')
})

it('retains folder effects and unresolved PSD images while removing only replaced leaf notices', () => {
  const leaf = layer({ kind: '3d', unsupported3D: true })
  const folder = layer({ id: 'folder', name: 'folder', isFolder: true, children: [leaf], effects: { watercolor: { range: 5, opacity: 50, darkness: 20, blur: 10 } } })
  const document = doc([folder])
  document.diagnostics = [{ scope: 'raster', layerId: 'art', message: '画像の読込に失敗' }, { scope: 'timeline', message: '時間伸縮' }]
  document.diagnostics.push({ scope: 'raster', part: 'blend', layerId: 'folder', message: '元CLIPの合成モードは不明' })
  const source = { width: 8, height: 8, children: [{ name: 'folder', children: [{ name: 'art', canvas: globalThis.document.createElement('canvas') }] }] }
  const paired = buildClipLayerTree(document, source, undefined, DEFAULT_PROJECT_SETTINGS)
  expect(resolveClipDiagnostics(document, paired, true)).toEqual([
    { scope: 'timeline', message: '時間伸縮' }, expect.objectContaining({ layerId: 'folder', outcome: 'missing-effect' }),
  ])
  const missing = buildClipLayerTree(document, { ...source, children: [{ name: 'folder', children: [{ name: 'art' }] }] }, undefined, DEFAULT_PROJECT_SETTINGS)
  expect(resolveClipDiagnostics(document, missing, true).some(d => d.layerId === 'art' && d.outcome === 'missing-content')).toBe(true)
  expect(missing[0].children[0].unsupported3D).toBe(true)
  const unpaired = buildClipLayerTree(document, clipRenderingSource(document), undefined, DEFAULT_PROJECT_SETTINGS, false)
  expect(resolveClipDiagnostics(document, unpaired, false).find(d => d.part === 'effect')?.message).toContain('互換情報付きで保存しても')
})

it('parses compatibility and folder effects even when paired loading skips raster decoding', async () => {
  const bytes = readFileSync('public/sample/c001.clip')
  const SQL = await initSqlJs({ wasmBinary: new Uint8Array(readFileSync('node_modules/sql.js/dist/sql-wasm.wasm')).buffer })
  const effects = JSON.parse(readFileSync('testdata/clip-effects/effects.json', 'utf8'))
  for (let offset = 24; offset < bytes.length;) {
    const end = offset + 16 + Number(bytes.readBigUInt64BE(offset + 8))
    if (bytes.toString('ascii', offset, offset + 8) !== 'CHNKSQLi') { offset = end; continue }
    const database = new SQL.Database(bytes.subarray(offset + 16, end))
    try {
      const columns = database.exec('PRAGMA table_info(Canvas)')[0].values.map(v => v[1])
      if (!columns.includes('CanvasRenderMipmapForceSaved')) database.run('ALTER TABLE Canvas ADD COLUMN CanvasRenderMipmapForceSaved INTEGER')
      database.run('UPDATE Canvas SET CanvasRenderMipmapForceSaved=1')
      const layerColumns = database.exec('PRAGMA table_info(Layer)')[0].values.map(v => v[1])
      if (!layerColumns.includes('LayerEffectAttached')) database.run('ALTER TABLE Layer ADD COLUMN LayerEffectAttached INTEGER')
      if (!layerColumns.includes('LayerEffectInfo')) database.run('ALTER TABLE Layer ADD COLUMN LayerEffectInfo BLOB')
      database.run('UPDATE Layer SET LayerEffectAttached=1, LayerEffectInfo=? WHERE (LayerFolder & 1)=1', [Buffer.from(effects.watercolor, 'base64')])
      const data = Buffer.from(database.export()), header = Buffer.from(bytes.subarray(offset, offset + 16))
      header.writeBigUInt64BE(BigInt(data.length), 8)
      const parsed = await parseClipDocument(Buffer.concat([bytes.subarray(0, offset), header, data, bytes.subarray(end)]), SQL, false)
      expect(parsed.compatibility).toBe('saved')
      const all = (ls: ClipLayer[]): ClipLayer[] => ls.flatMap(l => [l, ...all(l.children)])
      expect(all(parsed.layers).filter(l => l.isFolder).every(l => !!l.effects?.watercolor)).toBe(true)
      expect(all(parsed.layers).some(l => l.pixels)).toBe(false)
      return
    } finally { database.close() }
  }
  throw new Error('Missing fixture database')
})

it('records only contributing layers per exported file and keeps lazy rendering and release callbacks', () => {
  const canvas = document.createElement('canvas'), release = vi.fn()
  recordComposite(canvas, [{ canvas, sourceId: 'clip:used', left: 0, top: 0, opacity: 100, blendMode: 'normal', clipping: false }])
  const createCanvas = vi.fn(() => canvas)
  const tracked = trackExportDiagnostics([{ path: 'A/A_001.png', flatName: 'A_001.png', sourceLayerId: 'A', createCanvas, releaseRenderCache: release }], [
    { scope: 'raster', layerId: 'used', message: '使った素材の案内' }, { scope: 'raster', layerId: 'hidden', message: '選択外の素材の案内' },
  ], DEFAULT_OUTPUT_CONFIG)
  expect(createCanvas).not.toHaveBeenCalled()
  expect(tracked.messages()).toEqual([])
  const entry = tracked.entries[0]
  if (!('createCanvas' in entry)) throw new Error('Expected lazy output')
  entry.createCanvas()
  expect(tracked.messages()).toEqual(['A_001.png — 使った素材の案内'])
  expect(entry.releaseRenderCache).toBe(release)
})
