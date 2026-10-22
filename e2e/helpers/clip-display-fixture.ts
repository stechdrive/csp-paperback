import { readFile } from 'node:fs/promises'
import initSqlJs from 'sql.js'

/** Public sample hierarchy with a synthetic folder effect/mask identification case. */
export async function clipDisplayFixture(mask: 'enabled' | 'disabled' | 'none') {
  const bytes = await readFile('public/sample/c001.clip'), SQL = await initSqlJs()
  const u32 = (value: number) => { const result = Buffer.alloc(4); result.writeUInt32BE(value); return result }
  const radius = Buffer.alloc(8); radius.writeDoubleBE(2)
  const name = 'EffectEdge'
  const edge = Buffer.concat([Buffer.alloc(8), u32(name.length), Buffer.from(name, 'utf16le').swap16(),
    u32(1), radius, u32(0xffffffff), u32(0xffffffff), u32(0xffffffff)])
  for (let offset = 24; offset < bytes.length;) {
    const end = offset + 16 + Number(bytes.readBigUInt64BE(offset + 8))
    if (bytes.toString('ascii', offset, offset + 8) === 'CHNKSQLi') {
      const db = new SQL.Database(bytes.subarray(offset + 16, end))
      try {
        const columns = new Set(db.exec('PRAGMA table_info(Layer)')[0].values.map(row => row[1]))
        for (const field of ['DrawColorSubRed', 'DrawColorSubGreen', 'DrawColorSubBlue']) {
          if (!columns.has(field)) db.run(`ALTER TABLE Layer ADD COLUMN ${field} INTEGER DEFAULT 4294967295`)
        }
        if (!columns.has('LayerEffectAttached')) db.run('ALTER TABLE Layer ADD COLUMN LayerEffectAttached INTEGER DEFAULT 0')
        if (!columns.has('LayerEffectInfo')) db.run('ALTER TABLE Layer ADD COLUMN LayerEffectInfo BLOB')
        db.run(`UPDATE Layer SET LayerType = (COALESCE(LayerType, 0) & ~2) | ?, LayerVisibility = ?,
          LayerUsePaletteColor = 1, LayerPaletteRed = ?, LayerPaletteGreen = ?, LayerPaletteBlue = ?,
          DrawColorEnable = 1, DrawColorMainRed = 0, DrawColorMainGreen = 0, DrawColorMainBlue = 4294967295,
          DrawColorSubRed = 4294967295, DrawColorSubGreen = 4294967295, DrawColorSubBlue = 4294967295,
          LayerEffectAttached = 1, LayerEffectInfo = ? WHERE LayerName = '_BG'`,
        [mask === 'none' ? 0 : 2, mask === 'enabled' ? 3 : 1, ...[197, 217, 196].map(c => c * 0x01010101), edge])
        const database = Buffer.from(db.export()), header = Buffer.alloc(16)
        header.write('CHNKSQLi'); header.writeBigUInt64BE(BigInt(database.length), 8)
        return Buffer.concat([bytes.subarray(0, offset), header, database, bytes.subarray(end)])
      } finally { db.close() }
    }
    offset = end
  }
  throw new Error('Sample database not found')
}
