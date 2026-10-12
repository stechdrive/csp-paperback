import type { SqlJsStatic, Database, SqlValue } from 'sql.js'
import { CLIP_BLEND_MODES as blends } from './blend'
import { check, readContainer } from './binary'
import { readActionMixer } from './binc'
import { readCelFrames } from './timeline'
import { readAttribute } from './raster'
import { createMaterialDecoder } from './material'
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

export async function parseClipDocument(bytes: Uint8Array, SQL: SqlJsStatic, includeRaster = true): Promise<ClipDocument> {
  const container = readContainer(bytes)
  const db = new SQL.Database(container.database)
  try {
    db.run('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF;')
    const canvases = rows(db, 'Canvas')
    check(canvases.length === 1, '複数キャンバスまたはキャンバスのないファイルには未対応です')
    const canvas = canvases[0]
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
        if (!blends[composite]) diagnostics.push({ scope: 'raster', layerId: key, message: `「${str(row.LayerName)}」の合成モード ${composite} は未対応です（通常で表示）` })
        result.push({ id: key, name: str(row.LayerName), isFolder: !!(num(row, 'LayerFolder') & 1),
          kind: num(row, 'LayerType') & 512 ? 'camera' : num(row, 'LayerFolder') & 1 ? 'folder' : row.FilterLayerInfo ? 'adjustment' : row.TextLayerString != null || row.TextLayerStringArray != null ? 'text' : row.ResizableImageInfo ? 'image-material' : num(row, 'LayerType') & 4 ? 'vector' : num(row, 'LayerType') & 1 ? 'raster' : 'other',
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
    if (includeRaster) {
      const decode = createMaterialDecoder({ mipmaps, mipInfos, offscreens, thumbnails: rows(db, 'LayerThumbnail'), external: container.external }, width, height, num(canvas, 'CanvasResolution'), diagnostics)
      async function walk(layers: ClipLayer[]): Promise<void> {
        for (const layer of layers) {
          try { await decode(layer, nativeRows.get(layer.id)!) }
          catch (e) { diagnostics.push({ scope: 'raster', layerId: layer.id, message: `「${layer.name}」: ${errorMessage(e)}` }) }
          await walk(layer.children)
        }
      }
      await walk(layers)
    }
    return { width, height, dpi: num(canvas, 'CanvasResolution'), layers, timelines, defaultTimelineId: defaultTimelineId ?? timelines[0]?.id ?? null, diagnostics }
  } finally { db.close() }
}
