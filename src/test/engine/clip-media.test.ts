import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { clipMediaFixture } from '../fixtures/clip-media'
import { parseClipDocument } from '../../utils/clip/parser'
import { readLayerKind, readMediaItemKind } from '../../utils/clip/layer-metadata'
import { buildClipLayerTree, clipRenderingSource } from '../../engine/clip-tree'
import { flattenTree } from '../../engine/flatten'
import { planAllEntries } from '../../engine/cell-extractor'
import { outputSources } from '../../engine/render-sources'
import { DEFAULT_PROJECT_SETTINGS } from '../../types'
import { isMediaLayer } from '../../utils/layer-display'
import { renderIssues } from '../../utils/render-diagnostics'
import { resolveClipDiagnostics } from '../../utils/clip/rendering-status'
import { useAppStore } from '../../store'
import { resetTestStore } from '../helpers/store-reset'
import { resolveVirtualSetLayers, planVirtualSetDrop } from '../../utils/virtual-set-tree'
import { readContainer } from '../../utils/clip/binary'

let SQL: SqlJsStatic
beforeAll(async () => { SQL = await initSqlJs({ wasmBinary: new Uint8Array(readFileSync('node_modules/sql.js/dist/sql-wasm.wasm')).buffer }) })
afterEach(() => resetTestStore())

describe('media layers are identified but never rendered as still artwork', () => {
  it('uses explicit media metadata and keeps camera folders, paper, image objects and unknowns distinct', () => {
    expect(readLayerKind({ AudioLayer: 1, LayerType: 8720 })).toBe('audio')
    expect(readLayerKind({ LayerType: 8720 })).toBe('other')
    expect(readLayerKind({ LayerType: 512, LayerFolder: 1 })).toBe('camera')
    expect(readLayerKind({ LayerType: 1584 })).toBe('paper')
    expect(readLayerKind({ LayerType: 1, LayerName: 'sound.wav' })).toBe('raster')
    expect(readMediaItemKind({ ItemType: 'Audio', ItemFileExtension: 'mp4' })).toBe('audio')
    expect(readMediaItemKind({ ItemType: 'Movie' })).toBe('video')
    expect(readMediaItemKind({ ItemType: 'FileObject', ItemFileExtension: '.MOV' })).toBe('video')
    expect(readMediaItemKind({ ItemType: 'FileObject', ItemFileExtension: 'png' })).toBeUndefined()
  })

  it.each([false, true])('excludes media from normal/marked output and warnings, including paired PSD images (%s)', async paired => {
    const clip = await parseClipDocument(await clipMediaFixture(true), SQL)
    const media = clip.layers.filter(layer => ['audio', 'video'].includes(layer.kind!))
    expect(media.map(layer => layer.kind)).toEqual(['video', 'audio'])
    expect(media.every(layer => !layer.pixels && !layer.mask)).toBe(true)
    expect(clip.diagnostics).toHaveLength(1)
    expect(clip.diagnostics[0].message).toContain('不明な素材')
    const source = clipRenderingSource(clip)
    if (paired) for (const child of source.children!) child.canvas = document.createElement('canvas')
    const tree = buildClipLayerTree(clip, source, undefined, DEFAULT_PROJECT_SETTINGS, paired)
    const mediaLayers = tree.filter(isMediaLayer)
    // Previously saved marks/visibility overrides must not re-enable media output.
    mediaLayers.forEach(layer => { layer.singleMark = true; layer.autoMarked = true; layer.hidden = false; layer.uiHidden = false })
    expect(flattenTree(mediaLayers, 16, 16)).toEqual([])
    const diagnostics = resolveClipDiagnostics(clip, tree, paired)
    expect(renderIssues(mediaLayers, diagnostics)).toEqual([])
    const plan = planAllEntries(tree, DEFAULT_PROJECT_SETTINGS, 16, 16)
    expect(plan.map(entry => entry.flatName).sort()).toEqual(['_A.jpg', '_B.jpg'])
    for (const entry of plan) {
      const sources = outputSources(entry.renderCanvas(new Map())).all
      expect(mediaLayers.some(layer => sources.has(layer.id))).toBe(false)
    }
    if (!paired) expect(renderIssues(tree, diagnostics).map(issue => issue.layerName)).toEqual(['不明な素材'])
  })

  it('also recognizes audio objects and direct resource references without classifying unrelated layers', async () => {
    const db = new SQL.Database(readContainer(await clipMediaFixture()).database)
    let bytes: Buffer
    try {
      db.run(`UPDATE Layer SET AudioLayer = 0 WHERE MainId = 4;
        INSERT INTO LayerObject VALUES (4, NULL, 1);
        UPDATE Layer SET BankItemUuid = '00000000000000000000000000000032' WHERE MainId = 5;
        DELETE FROM LayerObject WHERE LayerId = 5;
        UPDATE CanvasItem SET ItemType = 'FileObject', ItemFileExtension = 'MOV';`)
      const database = db.export()
      bytes = Buffer.alloc(40 + database.length); bytes.write('CSFCHUNK'); bytes.write('CHNKSQLi', 24)
      bytes.writeBigUInt64BE(BigInt(database.length), 32); bytes.set(database, 40)
    } finally { db.close() }
    const clip = await parseClipDocument(bytes, SQL)
    expect(clip.layers.map(layer => layer.kind)).toEqual(['video', 'audio', 'folder', 'folder'])
    expect(clip.diagnostics).toEqual([])
  })

  it('rejects media controls and virtual membership, including parent drops and legacy references', async () => {
    const clip = await parseClipDocument(await clipMediaFixture(), SQL)
    const tree = buildClipLayerTree(clip, clipRenderingSource(clip), undefined, DEFAULT_PROJECT_SETTINGS, false)
    resetTestStore({ layerTree: tree, docWidth: 16, docHeight: 16 })
    const state = () => useAppStore.getState()
    state().addVirtualSet('test')
    state().clearHistory()
    const setId = state().virtualSets[0].id
    for (const layer of tree.filter(isMediaLayer)) {
      state().toggleLayerVisibility(layer.id)
      state().toggleSingleMark(layer.id)
      state().setLayerBlendMode(layer.id, 'multiply')
      state().setLayerOpacity(layer.id, 25)
      state().addVirtualSetMember(setId, layer.id)
      state().openQuickLook(layer.id)
      state().insertVirtualSetLayers(setId, [layer.id], { layerId: null, position: 'inside' })
    }
    expect(state()._past).toHaveLength(0)
    expect(state().singleMarks.size).toBe(0)
    expect(state().visibilityOverrides.size).toBe(0)
    expect(state().virtualSets[0].members).toEqual([])
    expect(state().quickLookTarget).toBeNull()
    const vs = { ...state().virtualSets[0], members: tree.map(layer => ({ layerId: layer.id, blendMode: null, opacity: null })) }
    expect(resolveVirtualSetLayers(tree, vs).map(layer => layer.originalName)).toEqual(['_B', '_A'])
    expect(resolveVirtualSetLayers(tree, { ...vs, tree: tree.map(layer => ({ layerId: layer.id, children: [] })) })
      .map(layer => layer.originalName)).toEqual(['_B', '_A'])
    const parent = { ...tree[0], id: 'parent', display: { kind: 'folder' as const }, isFolder: true, children: tree }
    const drop = planVirtualSetDrop(state().virtualSets[0], [parent], [parent.id], { layerId: null, position: 'inside' })!
    expect(drop[0].children.map(node => node.layerId)).toEqual(tree.filter(layer => !isMediaLayer(layer)).map(layer => layer.id))
  })
})
