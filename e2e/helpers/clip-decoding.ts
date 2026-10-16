import initSqlJs from 'sql.js'
import { readFileSync } from 'node:fs'
import { rasterFixture } from '../../src/test/fixtures/clip-raster'
import { vectorBytes } from '../../src/test/fixtures/clip-vector'

const u64 = (n: number) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b }
const chunk = (tag: string, body: Uint8Array) => Buffer.concat([Buffer.from(tag), u64(body.length), body])

/** Large blank paper with small raster/vector artwork; no production data. */
export async function clipDecodingFixture(kind: 'raster' | 'vector', width = 4096, height = 3072, count = 12): Promise<Buffer> {
  const SQL = await initSqlJs({ wasmBinary: readFileSync('node_modules/sql.js/dist/sql-wasm.wasm') })
  const db = new SQL.Database(), external: Buffer[] = []
  const addExternal = (id: string, data: Uint8Array) => external.push(chunk('CHNKExta', Buffer.concat([u64(id.length), Buffer.from(id), u64(data.length), data])))
  try {
    db.run(`CREATE TABLE Canvas (CanvasRootFolder INTEGER, CanvasWidth INTEGER, CanvasHeight INTEGER, CanvasUnit INTEGER, CanvasResolution INTEGER);
      CREATE TABLE Layer (MainId INTEGER, LayerUuid TEXT, LayerName TEXT, LayerFolder INTEGER, LayerType INTEGER,
        LayerFirstChildIndex INTEGER, LayerNextIndex INTEGER, LayerVisibility INTEGER, LayerOpacity INTEGER, LayerComposite INTEGER,
        LayerRenderMipmap INTEGER, LayerLayerMaskMipmap INTEGER, VectorNormalStrokeIndex INTEGER, LayerOffsetX INTEGER, LayerOffsetY INTEGER);
      CREATE TABLE Mipmap (MainId INTEGER, BaseMipmapInfo INTEGER);
      CREATE TABLE MipmapInfo (MainId INTEGER, ThisScale INTEGER, Offscreen INTEGER);
      CREATE TABLE Offscreen (MainId INTEGER, Attribute BLOB, BlockData TEXT);
      CREATE TABLE VectorObjectList (MainId INTEGER, LayerId INTEGER, VectorData TEXT);
      CREATE TABLE BrushStyle (MainId INTEGER, AntiAlias INTEGER, Hardness REAL, ThicknessBase REAL, FlowBase REAL, CompositeMode INTEGER);
      INSERT INTO BrushStyle VALUES (7, 1, 1, 1, 1, 0);`)
    db.run('INSERT INTO Canvas VALUES (1, ?, ?, 0, 144)', [width, height])
    const layer = (id: number, name: string, folder: number, type: number, first: number, next: number, raster = 0, mask = 0, vector = 0) => {
      db.run('INSERT INTO Layer VALUES (?, ?, ?, ?, ?, ?, ?, 3, 256, 0, ?, ?, ?, -3, 5)',
        [id, id.toString(16).padStart(32, '0'), name, folder, type, first, next, raster, mask, vector])
    }
    layer(1, 'root', 1, 256, 2, 0)
    for (let i = 0; i < count; i++) {
      const group = 2 + i * 2, id = group + 1
      layer(group, `_${kind === 'raster' ? 'R' : 'V'}_${String(i + 1).padStart(3, '0')}`, 1, 256, id, i === count - 1 ? 0 : group + 2)
      if (kind === 'raster') {
        const tile = Math.floor(height / 512) * Math.ceil(width / 256) + Math.floor(width / 512)
        const raw = new Uint8Array(65536), maskRaw = new Uint8Array(65536).fill(255)
        for (let y = 30; y < 190; y++) for (let x = 20; x < 200; x++) {
          raw[y * 256 + x] = (x * 3 + y * 7 + i * 13) % 256
          maskRaw[y * 256 + x] = x < 80 ? 32 + i : 255
        }
        for (const isMask of [false, true]) {
          const mid = id * 2 + +isMask, key = `image-${mid}`
          const f = rasterFixture(width, height, new Map([[tile, isMask ? maskRaw : raw]]),
            { hasColor: isMask, color: isMask ? 255 : 0 })
          db.run('INSERT INTO Mipmap VALUES (?, ?)', [mid, mid]); db.run('INSERT INTO MipmapInfo VALUES (?, 100, ?)', [mid, mid])
          db.run('INSERT INTO Offscreen VALUES (?, ?, ?)', [mid, f.attribute, key]); addExternal(key, f.body)
        }
        layer(id, 'ink', 0, 3, 0, 0, id * 2, id * 2 + 1)
      } else {
        layer(id, 'ink', 0, 0, 0, 0, 0, 0, id)
        const key = `vector-${id}`, x = width / 2, y = height / 2
        const strokes = Buffer.concat([
          vectorBytes({ points: [[x - 80, y - 40], [x, y + 50], [x + 80, y - 40]], diameter: 12 + i, opacity: .7 }),
          vectorBytes({ points: [[x - 70, y], [x + 70, y]], diameter: 7, opacity: .45 }),
        ])
        db.run('INSERT INTO VectorObjectList VALUES (?, ?, ?)', [id, id, key]); addExternal(key, strokes)
      }
    }
    const header = Buffer.alloc(24); header.write('CSFCHUNK')
    return Buffer.concat([header, chunk('CHNKSQLi', db.export()), ...external])
  } finally { db.close() }
}
