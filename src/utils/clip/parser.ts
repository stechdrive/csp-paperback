import type { SqlJsStatic, Database, SqlValue } from 'sql.js'
import { CLIP_BLEND_MODES as blends } from './blend'
import { check, readContainer } from './binary'
import { readActionMixer } from './binc'
import { readCelFrames } from './timeline'
import { readAttribute } from './raster'
import { createMaterialDecoder, readMaterialEffects } from './material'
import { hasLayerMask, readLayerKind, readMediaItemKind, readPaletteColor } from './layer-metadata'
import { isMediaKind } from '../layer-display'
import { num, str, errorMessage, type ClipRow as Row } from './records'
import type { ClipDiagnostic, ClipDocument, ClipLayer, ClipTimeline } from './types'

const uuid = (value: SqlValue | undefined): string => value instanceof Uint8Array ? Array.from(value, v => v.toString(16).padStart(2, '0')).join('') : str(value).replaceAll('-', '').toLowerCase()

function rows(db: Database, table: string): Row[] {
  // Only fixed application table names reach this function. Views are deliberately excluded.
  if (!db.exec('SELECT 1 FROM sqlite_master WHERE type=\'table\' AND name=?', [table]).length) return []
  const stmt = db.prepare(`SELECT * FROM "${table}" LIMIT 50001`)
  const result: Row[] = []
  try {
    while (stmt.step()) { check(result.length < 50000, `${table}の行数が上限を超えました`); result.push(stmt.getAsObject()) }
  } finally { stmt.free() }
  return result
}
const keyed = (records: Row[]) => new Map(records.map(r => [num(r, 'MainId'), r]))

export interface ClipSession {
  document: ClipDocument
  decode: (id: string) => Promise<{ layer: ClipLayer; diagnostics: ClipDiagnostic[] }>
}

export async function openClipSession(bytes: Uint8Array, SQL: SqlJsStatic): Promise<ClipSession> {
  const container = readContainer(bytes)
  const db = new SQL.Database(container.database)
  try {
    db.run('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF;')
    const canvases = rows(db, 'Canvas')
    check(canvases.length === 1, '複数キャンバスまたはキャンバスのないファイルには未対応です')
    const canvas = canvases[0]
    const compatibility = canvas.CanvasRenderMipmapForceSaved === 1 ? 'saved'
      : canvas.CanvasRenderMipmapForceSaved === 0 ? 'not-saved' : 'unknown'
    const layerRows = rows(db, 'Layer'), layersById = keyed(layerRows)
    const root = layersById.get(num(canvas, 'CanvasRootFolder'))
    check(root && layerRows.length === layersById.size, 'レイヤーツリーのルートまたはIDが不正です')
    const mipmaps = keyed(rows(db, 'Mipmap')), mipInfos = keyed(rows(db, 'MipmapInfo')), offscreens = keyed(rows(db, 'Offscreen'))
    function offscreen(row: Row, mask = false): Row | undefined {
      const mip = mipmaps.get(num(row, mask ? 'LayerLayerMaskMipmap' : 'LayerRenderMipmap'))
      const info = mip && mipInfos.get(num(mip, 'BaseMipmapInfo'))
      return info && num(info, 'ThisScale', 100) === 100 ? offscreens.get(num(info, 'Offscreen')) : undefined
    }
    const rootOffscreen = offscreen(root)
    const rootAttribute = rootOffscreen?.Attribute instanceof Uint8Array ? readAttribute(rootOffscreen.Attribute) : undefined
    const width = rootAttribute?.width ?? num(canvas, 'CanvasWidth'), height = rootAttribute?.height ?? num(canvas, 'CanvasHeight')
    check(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width * height <= 64 * 1024 * 1024, 'キャンバス寸法が上限を超えるか不正です')
    check(rootAttribute || num(canvas, 'CanvasUnit') === 0, 'キャンバスのピクセル寸法が取得できません')
    const diagnostics: ClipDiagnostic[] = []
    const vectors = keyed(rows(db, 'VectorObjectList'))
    const vectorLayerIds = new Set([...vectors.values()].map(v => num(v, 'LayerId')))
    const mediaItems = new Map(rows(db, 'CanvasItem').filter(item => /^[0-9a-f]{32}$/.test(uuid(item.ItemUuid)))
      .map(item => [uuid(item.ItemUuid), readMediaItemKind(item)]))
    const mediaObjects = new Map<number, 'audio' | 'video'>()
    for (const object of rows(db, 'LayerObject')) {
      const kind = num(object, 'IsAudio') ? 'audio' : mediaItems.get(uuid(object.BankItemUuid))
      if (kind) mediaObjects.set(num(object, 'LayerId'), kind)
    }
    const nativeRows = new Map<string, Row>()
    const visited = new Set<number>([num(root, 'MainId')])
    function children(parent: Row, depth: number): ClipLayer[] {
      check(depth <= 128, 'レイヤー階層が深すぎます')
      const result: ClipLayer[] = []
      let next = num(parent, 'LayerFirstChildIndex')
      while (next) {
        const row = layersById.get(next)
        check(row && !visited.has(next), 'レイヤー参照の循環または欠落があります')
        visited.add(next)
        // Light-table references share the layer sibling list, but are drawing aids,
        // not canvas artwork. Their saved previews would otherwise cover every cel
        // and introduce extra layers absent from CSP's PSD export.
        if (num(row, 'LightTableReferCell')) {
          next = num(row, 'LayerNextIndex')
          continue
        }
        const key = uuid(row.LayerUuid)
        check(/^[0-9a-f]{32}$/.test(key) && !nativeRows.has(key), 'レイヤーUUIDが不正または重複しています')
        nativeRows.set(key, row)
        const composite = num(row, 'LayerComposite')
        const kind = readLayerKind(row, vectorLayerIds.has(next), mediaObjects.get(next) ?? mediaItems.get(uuid(row.BankItemUuid)))
        if (!isMediaKind(kind) && !blends[composite]) diagnostics.push({ scope: 'raster', part: 'blend', code: 'UNSUPPORTED_LAYER_BLEND', layerId: key, message: `「${str(row.LayerName)}」: 合成モード ${composite} は未対応です（通常で表示）` })
        result.push({ id: key, name: str(row.LayerName), isFolder: !!(num(row, 'LayerFolder') & 1),
          kind, paletteColor: readPaletteColor(row),
          maskState: hasLayerMask(row) ? num(row, 'LayerVisibility') & 2 ? 'enabled' : 'disabled' : undefined,
          nativeBlendMode: composite,
          isAnimationFolder: !!num(row, 'AnimationFolder'), expanded: !(num(row, 'LayerFolder') & 16),
          hidden: !(num(row, 'LayerVisibility') & 1), opacity: Math.max(0, Math.min(1, num(row, 'LayerOpacity', 256) / 256)),
          blendMode: blends[composite] ?? 'normal', clipping: !!num(row, 'LayerClip'), children: children(row, depth + 1) })
        next = num(row, 'LayerNextIndex')
      }
      return result.reverse()
    }
    const layers = children(root, 0)
    const tracks = keyed(rows(db, 'Track')), timelines: ClipTimeline[] = []
    const timelineRows = keyed(rows(db, 'TimeLine')), banks = rows(db, 'AnimationCutBank')
    let defaultTimelineId: number | null = null
    for (const bank of banks) {
      let next = num(bank, 'FirstTimeLine'), index = 0
      const visited = new Set<number>()
      while (next) {
        check(!visited.has(next), 'タイムラインに循環があります')
        visited.add(next)
        const row = timelineRows.get(next)
        check(row, 'タイムライン参照がありません')
        if (index === num(bank, 'CurrentIndex')) defaultTimelineId ??= next
        index++
        next = num(row, 'NextTimeLine')
      }
    }
    for (const row of timelineRows.values()) {
      const fps = num(row, 'FrameRate'), startFrame = num(row, 'StartFrame'), end = num(row, 'EndFrame')
      check(fps > 0 && fps <= 1000 && Number.isInteger(startFrame) && Number.isInteger(end) && end > startFrame && end - startFrame <= 10000000, 'タイムラインの範囲またはfpsが不正です')
      const timeline: ClipTimeline = { id: num(row, 'MainId'), bindings: {}, diagnostics: [], otherTracks: [], data: {
        version: 10, header: { cut: '', scene: '' }, timeTableName: str(row.TimeLineName), duration: end - startFrame, fps, tracks: [],
      } }
      const seen = new Set<number>()
      let next = num(row, 'FirstTrack')
      while (next) {
        const track = tracks.get(next)
        check(track && !seen.has(next), 'トラック参照の循環または欠落があります')
        seen.add(next)
        const layerId = uuid(track.LayerUuidWithTrack), layer = nativeRows.get(layerId)
        const external = container.external.get(str(track.TrackActionMixer))
        if (num(track, 'TrackKind') === 2000) {
          try {
            check(layer && num(layer, 'AnimationFolder'), 'セルの参照先フォルダが見つかりません')
            check(external && !Object.hasOwn(timeline.bindings, layerId), 'セル曲線の欠落またはトラックの重複があります')
            const frames = readCelFrames(await readActionMixer(external), fps, startFrame)
            timeline.bindings[layerId] = next
            timeline.data.tracks.push({ name: str(layer.LayerName), trackNo: next, frames, cellNames: [...new Set(frames.flatMap(f => f.cellName === null ? [] : [f.cellName]))] })
          } catch (e) { timeline.diagnostics.push({ scope: 'timeline', layerId, message: `「${str(layer?.LayerName) || next}」: ${errorMessage(e)}` }) }
        } else {
          timeline.otherTracks!.push({ id: next, layerId, kind: num(track, 'TrackKind'),
            role: num(track, 'TrackKind') === 2005 ? 'camera' : [1000, 2001, 2003].includes(num(track, 'TrackKind')) ? 'transform' : 'other' })
        }
        next = num(track, 'TrackNextIndex')
      }
      timelines.push(timeline)
    }
    const tables = { mipmaps, mipInfos, offscreens, thumbnails: rows(db, 'LayerThumbnail'), external: container.external,
        vectors, brushes: keyed(rows(db, 'BrushStyle')), brushGraphs: keyed(rows(db, 'BrushEffectorGraphData')),
        brushPatterns: keyed(rows(db, 'BrushPatternStyle')), brushImages: keyed(rows(db, 'BrushPatternImage')),
      }
    const nativeLayers = new Map<string, ClipLayer>()
    const walk = (layers: ClipLayer[]) => layers.forEach(layer => {
        nativeLayers.set(layer.id, layer)
        layer.effects = isMediaKind(layer.kind) ? undefined : readMaterialEffects(nativeRows.get(layer.id)!, (message, code) => diagnostics.push({
          scope: 'raster', part: 'effect', outcome: 'missing-effect', code, layerId: layer.id, message: `「${layer.name}」: ${message}`,
        }))
        walk(layer.children)
      })
    walk(layers)
    const document: ClipDocument = { width, height, dpi: num(canvas, 'CanvasResolution'), compatibility, layers, timelines, defaultTimelineId: defaultTimelineId ?? timelines[0]?.id ?? null, diagnostics }
    return {
      document,
      async decode(id) {
        const metadata = nativeLayers.get(id), row = nativeRows.get(id)
        check(metadata && row, '素材の参照先がありません')
        const layer: ClipLayer = { ...metadata, children: [] }
        const diagnostics: ClipDiagnostic[] = []
        // Per-request working buffers/brush images die after transfer. No
        // document-wide decoded-byte counter and no retained pixel history.
        const decode = createMaterialDecoder(tables, width, height, document.dpi, diagnostics, compatibility)
        await decode(layer, row)
        return { layer, diagnostics }
      },
    }
  } finally { db.close() }
}

/** Eager adapter for format tests and callers that explicitly need pixel data. */
export async function parseClipDocument(bytes: Uint8Array, SQL: SqlJsStatic, includeRaster = true): Promise<ClipDocument> {
  const session = await openClipSession(bytes, SQL)
  if (includeRaster) {
    const walk = async (layers: ClipLayer[]) => {
      for (const layer of layers) {
        try {
          const decoded = await session.decode(layer.id)
          Object.assign(layer, { ...decoded.layer, children: layer.children })
          session.document.diagnostics.push(...decoded.diagnostics)
        } catch (error) {
          session.document.diagnostics.push({ scope: 'raster', part: 'material', outcome: 'missing-content',
            layerId: layer.id, message: `「${layer.name}」: ${errorMessage(error)}` })
        }
        await walk(layer.children)
      }
    }
    await walk(session.document.layers)
  }
  return session.document
}
