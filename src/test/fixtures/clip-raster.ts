import { deflateSync } from 'node:zlib'
import type { OffscreenAttribute } from '../../utils/clip/raster'

const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b }
const wide = (s: string) => Buffer.concat([u32(s.length), Buffer.from(s, 'utf16le').swap16()])

/** Synthetic CLIP tile records, also used by browser import fixtures. */
export function rasterFixture(width: number, height: number, data: Map<number, Uint8Array>, options: Partial<OffscreenAttribute> = {}) {
  const a: OffscreenAttribute = { width, height, cols: Math.ceil(width / 256), rows: Math.ceil(height / 256),
    channels: 0, bitDepth: 1, planeBytes: 65536, hasColor: false, color: 0, sizes: [], ...options }
  const chunks = Array.from({ length: a.cols * a.rows }, (_, index) => {
    const raw = data.get(index), compressed = raw && deflateSync(raw), length = Buffer.alloc(4)
    if (compressed) length.writeUInt32LE(compressed.length)
    const chunk = Buffer.concat([wide('BlockDataBeginChunk'), ...[index, raw?.length ?? 0, 256, 256, raw ? 1 : 0].map(u32),
      ...(compressed ? [u32(compressed.length + 4), length, compressed] : []), wide('BlockDataEndChunk')])
    return Buffer.concat([u32(chunk.length + 4), chunk])
  })
  a.sizes = chunks.map(c => c.length)
  const parameters = [width, height, a.cols, a.rows, 1, 0, a.channels, a.bitDepth, a.planeBytes, 0, 0, 0, 0, 0, 256, 256, 0, 0, 0, 0]
  const rgb = a.rgb ? [a.rgb[2], a.rgb[1], a.rgb[0], 0].map(v => u32((v * 0x1000000) >>> 0)) : []
  const attribute = Buffer.concat([Buffer.alloc(16), wide('Parameter'), ...parameters.map(u32), wide('InitColor'),
    ...[0, +a.hasColor, a.color, rgb.length, 0].map(u32), ...rgb, wide('BlockSize'), ...[0, a.sizes.length, 0, ...a.sizes].map(u32)])
  return { a, body: Buffer.concat(chunks), attribute }
}
