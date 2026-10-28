import { readFileSync } from 'node:fs'
import initSqlJs from 'sql.js'
import { rasterFixture } from './clip-raster'

/** Synthetic records only: two still outputs, audio, and a linked movie with a saved image. */
export async function clipMediaFixture(includeUnknown = false): Promise<Buffer> {
  const SQL = await initSqlJs({ wasmBinary: new Uint8Array(readFileSync('node_modules/sql.js/dist/sql-wasm.wasm')).buffer })
  const db = new SQL.Database()
  const uuid = (id: number) => id.toString(16).padStart(32, '0')
  const chunk = (name: string, data: Uint8Array) => {
    const header = Buffer.alloc(16); header.write(name); header.writeBigUInt64BE(BigInt(data.length), 8)
    return Buffer.concat([header, data])
  }
  try {
    db.run(`CREATE TABLE Canvas (CanvasRootFolder INTEGER, CanvasWidth INTEGER, CanvasHeight INTEGER, CanvasUnit INTEGER, CanvasResolution INTEGER);
      INSERT INTO Canvas VALUES (1, 16, 16, 0, 144);
      CREATE TABLE Layer (MainId INTEGER, LayerUuid TEXT, LayerName TEXT, LayerFolder INTEGER, LayerType INTEGER,
        LayerFirstChildIndex INTEGER, LayerNextIndex INTEGER, LayerVisibility INTEGER, LayerOpacity INTEGER,
        LayerRenderMipmap INTEGER, LayerComposite INTEGER, AudioLayer INTEGER, BankItemUuid TEXT, LayerLayerMaskMipmap INTEGER);
      CREATE TABLE CanvasItem (ItemUuid TEXT, ItemType TEXT, ItemFileExtension TEXT);
      CREATE TABLE LayerObject (LayerId INTEGER, BankItemUuid TEXT, IsAudio INTEGER);
      CREATE TABLE Mipmap (MainId INTEGER, BaseMipmapInfo INTEGER);
      CREATE TABLE MipmapInfo (MainId INTEGER, ThisScale INTEGER, Offscreen INTEGER);
      CREATE TABLE Offscreen (MainId INTEGER, Attribute BLOB, BlockData TEXT);
      INSERT INTO Mipmap VALUES (1, 1);
      INSERT INTO MipmapInfo VALUES (1, 100, 1);`)
    const add = (id: number, name: string, type: number, next: number, audio = 0) => db.run(
      'INSERT INTO Layer VALUES (?, ?, ?, ?, ?, ?, ?, 3, 256, 1, ?, ?, NULL, ?)',
      [id, uuid(id), name, id === 1 ? 1 : 0, type, id === 1 ? 2 : 0, next, id === 4 || id === 5 ? 12345 : 0, audio, id === 4 || id === 5 ? 99 : 0])
    add(1, 'root', 256, 0)
    add(2, '_A', 1, 3)
    add(3, '_B', 1, 4)
    add(7, 'art A', 1, 0)
    add(8, 'art B', 1, 0)
    db.run('UPDATE Layer SET LayerFolder = 1, LayerType = 0, LayerFirstChildIndex = MainId + 5, LayerRenderMipmap = 0 WHERE MainId IN (2, 3)')
    // The audio type shares bit 512 with cameras. A cached image must not make it drawable.
    add(4, '音声資料', 8720, 5, 1)
    add(5, '_映像資料', 8720, includeUnknown ? 6 : 0)
    db.run('INSERT INTO CanvasItem VALUES (?, ?, ?)', [uuid(50), 'Movie', 'mp4'])
    db.run('INSERT INTO LayerObject VALUES (5, ?, 0)', [uuid(50)])
    if (includeUnknown) {
      add(6, '不明な素材', 8192, 0)
      db.run('UPDATE Layer SET LayerRenderMipmap = 0 WHERE MainId = 6')
    }
    const raster = rasterFixture(16, 16, new Map(), { hasColor: true, color: 0 })
    db.run('INSERT INTO Offscreen VALUES (1, ?, NULL)', [raster.attribute])
    const header = Buffer.alloc(24); header.write('CSFCHUNK')
    return Buffer.concat([header, chunk('CHNKSQLi', db.export())])
  } finally { db.close() }
}
