import { readFile } from 'node:fs/promises'
import initSqlJs from 'sql.js'
import { openDocument } from 'celcodec'

/** Derive a diagnostic-heavy, two-timeline input from the public sample without altering it. */
export async function clipPreviewFixture() {
  const SQL = await initSqlJs()
  const session = openDocument(SQL, new Uint8Array(await readFile('public/sample/c001.clip')))
  let bytes: Buffer
  try {
    const id = '44444444444444444444444444444444'
    const plan = await session.planEdits([
      { type: 'duplicateTimeline', timelineId: session.document.timelines[0].id, id,
        name: '兼用カット・長いタイムライン名でも見出しは一行' },
      { type: 'setTimeline', timelineId: id, endFrame: 12 },
    ])
    if (!plan.allowed) throw new Error(JSON.stringify(plan.diagnostics))
    bytes = Buffer.from((await session.save(plan)).bytes)
  } finally { session.dispose() }
  // Deliberately unknown blend values exercise diagnostic UI. Timeline links
  // and UUIDs are authored by the public API, not copied SQLite rows.
  for (let offset = 24; offset < bytes.length;) {
    const size = Number(bytes.readBigUInt64BE(offset + 8))
    const end = offset + 16 + size
    if (bytes.toString('ascii', offset, offset + 8) === 'CHNKSQLi') {
      const db = new SQL.Database(bytes.subarray(offset + 16, end))
      try {
        db.run('UPDATE Layer SET LayerComposite = 999')
        const database = Buffer.from(db.export())
        const chunkHeader = Buffer.from(bytes.subarray(offset, offset + 16))
        chunkHeader.writeBigUInt64BE(BigInt(database.length), 8)
        return Buffer.concat([bytes.subarray(0, offset), chunkHeader, database, bytes.subarray(end)])
      } finally {
        db.close()
      }
    }
    offset = end
  }
  throw new Error('Sample CLIP has no SQLite chunk')
}
