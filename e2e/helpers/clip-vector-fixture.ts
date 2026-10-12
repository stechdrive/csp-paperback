import { readFile } from 'node:fs/promises'
import initSqlJs from 'sql.js'
import { vectorBytes } from '../../src/test/fixtures/clip-vector'

/** Keep the public PSD hierarchy, replacing leaf artwork with synthetic native vectors. */
export async function clipVectorFixture(kind: 'vector' | '3d' = 'vector') {
  const bytes = await readFile('public/sample/c001.clip'), SQL = await initSqlJs()
  const chunk = (tag: string, data: Buffer) => {
    const header = Buffer.alloc(16); header.write(tag); header.writeBigUInt64BE(BigInt(data.length), 8)
    return Buffer.concat([header, data])
  }
  const u64 = (n: number) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b }
  for (let offset = 24; offset < bytes.length;) {
    const end = offset + 16 + Number(bytes.readBigUInt64BE(offset + 8))
    if (bytes.toString('ascii', offset, offset + 8) === 'CHNKSQLi') {
      const db = new SQL.Database(bytes.subarray(offset + 16, end))
      try {
        const columns = new Set(db.exec('PRAGMA table_info(Layer)')[0].values.map(row => row[1]))
        for (const field of ['VectorNormalStrokeIndex', 'TimeLineOriginalMipmap', 'ResizableOriginalMipmap', 'LayerOffsetX', 'LayerOffsetY']) {
          if (!columns.has(field)) db.run(`ALTER TABLE Layer ADD COLUMN ${field} INTEGER DEFAULT 0`)
        }
        db.run('CREATE TABLE IF NOT EXISTS BrushStyle (MainId INTEGER PRIMARY KEY, AntiAlias INTEGER, Hardness REAL, FlowBase REAL, ThicknessBase REAL)')
        db.run(`CREATE TABLE IF NOT EXISTS VectorObjectList (MainId INTEGER, LayerId INTEGER, VectorData BLOB);
          DELETE FROM VectorObjectList;
          INSERT INTO VectorObjectList (MainId, LayerId, VectorData)
            SELECT 900000 + MainId, MainId, 'test-vector' FROM Layer WHERE (COALESCE(LayerFolder, 0) & 1) = 0 AND COALESCE(LayerType, 0) != 1584;
          UPDATE Layer SET VectorNormalStrokeIndex = 900000 + MainId, LayerType = 0,
            TimeLineOriginalMipmap = 0, LayerRenderMipmap = 0, ResizableOriginalMipmap = 0,
            LayerOffsetX = 0, LayerOffsetY = 0
            WHERE (COALESCE(LayerFolder, 0) & 1) = 0 AND COALESCE(LayerType, 0) != 1584;
          INSERT OR REPLACE INTO BrushStyle (MainId, AntiAlias, Hardness, FlowBase, ThicknessBase) VALUES (900007, 1, 1, 1, 1);`)
        if (kind === '3d') {
          if (!columns.has('Manager3DOd')) db.run('ALTER TABLE Layer ADD COLUMN Manager3DOd INTEGER DEFAULT 0')
          db.run('UPDATE Layer SET Manager3DOd = 1 WHERE VectorNormalStrokeIndex > 0')
        }
        const raw = vectorBytes({ brush: 900007, diameter: 20, points: [[300, 300], [600, 500]] })
        const ref = Buffer.from('test-vector')
        return Buffer.concat([bytes.subarray(0, offset), chunk('CHNKSQLi', Buffer.from(db.export())), bytes.subarray(end),
          chunk('CHNKExta', Buffer.concat([u64(ref.length), ref, u64(raw.length), raw]))])
      } finally { db.close() }
    }
    offset = end
  }
  throw new Error('Missing sample database')
}
