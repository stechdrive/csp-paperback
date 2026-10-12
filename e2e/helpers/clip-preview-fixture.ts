import { readFile } from 'node:fs/promises'
import initSqlJs from 'sql.js'

/** Derive a diagnostic-heavy, two-timeline input from the public sample without altering it. */
export async function clipPreviewFixture() {
  const bytes = await readFile('public/sample/c001.clip')
  const SQL = await initSqlJs()
  for (let offset = 24; offset < bytes.length;) {
    const size = Number(bytes.readBigUInt64BE(offset + 8))
    const end = offset + 16 + size
    if (bytes.toString('ascii', offset, offset + 8) === 'CHNKSQLi') {
      const db = new SQL.Database(bytes.subarray(offset + 16, end))
      try {
        db.run(`
          UPDATE Layer SET LayerComposite = 999;
          CREATE TEMP TABLE AlternateTimeline AS SELECT * FROM TimeLine WHERE MainId = 1;
          UPDATE AlternateTimeline SET _PW_ID = 2, MainId = 2, EndFrame = 12,
            TimeLineName = '兼用カット・長いタイムライン名でも見出しは一行';
          INSERT INTO TimeLine SELECT * FROM AlternateTimeline;
          UPDATE TimeLine SET NextTimeLine = 2 WHERE MainId = 1;
        `)
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
