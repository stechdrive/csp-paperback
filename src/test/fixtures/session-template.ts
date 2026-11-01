import { readFileSync } from 'node:fs'
import type { SqlJsStatic } from 'sql.js'
import { openDocument } from 'celcodec'
import { readContainer } from 'celcodec/read'

const templates = new WeakMap<SqlJsStatic, Promise<Uint8Array>>()

/** Test-only structural input derived in memory from the existing public sample.
 * No private corpus, captured bytes, external download, or new tracked CLIP.
 * This is synthetic test data, not evidence of CSP accepting a newly authored template.
 */
export function sessionTemplate(SQL: SqlJsStatic): Promise<Uint8Array> {
  if (process.env.CELCODEC_TEST_TEMPLATE) return Promise.resolve(new Uint8Array(readFileSync(process.env.CELCODEC_TEST_TEMPLATE)))
  let pending = templates.get(SQL)
  if (!pending) { pending = derive(SQL); templates.set(SQL, pending) }
  return pending.then(bytes => bytes.slice())
}

async function derive(SQL: SqlJsStatic): Promise<Uint8Array> {
  const input = readFileSync('public/sample/c001.clip')
  const db = new SQL.Database(readContainer(new Uint8Array(input)).database)
  let database: Uint8Array, rasterUuid: string
  try {
    const row = (where: string) => {
      const stmt = db.prepare(`SELECT * FROM Layer WHERE ${where} LIMIT 1`)
      try { if (!stmt.step()) throw new Error('Public sample template structure changed'); return stmt.getAsObject() }
      finally { stmt.free() }
    }
    const root = row('LayerType = 256'), paper = row('LayerType = 1584')
    const folder = row('AnimationFolder = 1'), raster = row('LayerType = 1')
    rasterUuid = String(raster.LayerUuid).replace(/-/g, '').toLowerCase()
    db.run('DELETE FROM Layer WHERE MainId NOT IN (?, ?, ?, ?)', [root.MainId, paper.MainId, folder.MainId, raster.MainId])
    db.run('UPDATE Layer SET LayerFirstChildIndex = 0, LayerNextIndex = 0, LayerLayerMaskMipmap = 0, LayerClip = 0')
    db.run('UPDATE Layer SET LayerFirstChildIndex = ? WHERE MainId = ?', [folder.MainId, root.MainId])
    db.run('UPDATE Layer SET LayerFirstChildIndex = ?, LayerNextIndex = ? WHERE MainId = ?', [raster.MainId, paper.MainId, folder.MainId])
    db.run('UPDATE Canvas SET CanvasCurrentLayer = ?', [raster.MainId])
    db.run('DELETE FROM Track WHERE NOT ((TrackKind = 2000 AND LayerUuidWithTrack = ?) OR (TrackKind = 2003 AND LayerUuidWithTrack = ?))', [folder, paper].map(layer => new Uint8Array(Buffer.from(String(layer.LayerUuid).replace(/-/g, ''), 'hex'))))
    const tracks = db.exec('SELECT MainId, TrackKind FROM Track')[0].values
    const cel = tracks.find(t => t[1] === 2000)?.[0], paperTrack = tracks.find(t => t[1] === 2003)?.[0]
    if (tracks.length !== 2 || cel == null || paperTrack == null) throw new Error('Public sample template tracks changed')
    db.run('UPDATE Track SET TrackNextIndex = 0')
    db.run('UPDATE Track SET TrackNextIndex = ? WHERE MainId = ?', [paperTrack, cel])
    db.run('UPDATE TimeLine SET FirstTrack = ?', [cel])
    database = db.export()
  } finally { db.close() }
  let bytes: Uint8Array | undefined
  for (let offset = 24; offset < input.length;) {
    const end = offset + 16 + Number(input.readBigUInt64BE(offset + 8))
    if (input.toString('ascii', offset, offset + 8) === 'CHNKSQLi') {
      const header = Buffer.from(input.subarray(offset, offset + 16))
      header.writeBigUInt64BE(BigInt(database.length), 8)
      bytes = new Uint8Array(Buffer.concat([input.subarray(0, offset), header, database, input.subarray(end)]))
      break
    }
    offset = end
  }
  if (!bytes) throw new Error('Public sample database not found')
  const session = openDocument(SQL, bytes)
  try {
    const plan = await session.planEdits([{ type: 'replaceRasterPixels', layerId: rasterUuid,
      pixels: { width: 1, height: 1, channels: 4, data: new Uint8Array(4) }, left: 0, top: 0 }])
    if (!plan.allowed) throw new Error(JSON.stringify(plan.diagnostics))
    return (await session.save(plan)).bytes
  } finally { session.dispose() }
}
