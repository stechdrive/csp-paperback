import type { OutputFormat } from '../types'

/**
 * CanvasをBlobに変換する
 * @param canvas 変換元キャンバス
 * @param format 'jpg' | 'png'
 * @param quality JPGの場合の品質 (0.0〜1.0)
 * @param dpiX   水平DPI（0 = 埋め込みなし）
 * @param dpiY   垂直DPI（0 = 埋め込みなし）
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality = 0.92,
  dpiX = 0,
  dpiY = 0,
): Promise<Blob> {
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png'
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error(`Failed to convert canvas to ${format} blob`)),
      mimeType,
      format === 'jpg' ? quality : undefined,
    )
  })

  if (dpiX > 0 && dpiY > 0) {
    return format === 'jpg'
      ? injectDpiJpeg(blob, dpiX, dpiY)
      : injectDpiPng(blob, dpiX, dpiY)
  }
  return blob
}

/**
 * JPEGのJFIF APP0セグメントにDPI情報を埋め込む
 * ブラウザが生成するJPEGはほぼ必ずJFIF形式のAPP0を持つが、
 * ない場合はSOIの直後に挿入する。
 */
async function injectDpiJpeg(blob: Blob, dpiX: number, dpiY: number): Promise<Blob> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)

  const dxH = (dpiX >> 8) & 0xFF
  const dxL = dpiX & 0xFF
  const dyH = (dpiY >> 8) & 0xFF
  const dyL = dpiY & 0xFF

  // SOI確認
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return blob

  // APP0 (FF E0) + JFIF\0 が SOI の直後にある場合
  if (
    bytes[2] === 0xFF && bytes[3] === 0xE0 &&
    bytes[6] === 0x4A && bytes[7] === 0x46 && bytes[8] === 0x49 &&
    bytes[9] === 0x46 && bytes[10] === 0x00
  ) {
    // 既存APP0を書き換え（コピーして修正）
    const out = new Uint8Array(bytes)
    out[13] = 0x01  // DensityUnit = pixels/inch
    out[14] = dxH; out[15] = dxL  // Xdensity
    out[16] = dyH; out[17] = dyL  // Ydensity
    return new Blob([out], { type: 'image/jpeg' })
  }

  // APP0がない場合はSOIの直後にJFIF APP0を挿入
  const app0 = new Uint8Array([
    0xFF, 0xE0, 0x00, 0x10,           // marker + length=16
    0x4A, 0x46, 0x49, 0x46, 0x00,     // "JFIF\0"
    0x01, 0x01,                        // version 1.1
    0x01,                              // DensityUnit = pixels/inch
    dxH, dxL,                         // Xdensity
    dyH, dyL,                         // Ydensity
    0x00, 0x00,                        // no thumbnail
  ])
  const out = new Uint8Array(2 + app0.length + bytes.length - 2)
  out.set(bytes.slice(0, 2))           // SOI
  out.set(app0, 2)                     // JFIF APP0
  out.set(bytes.slice(2), 2 + app0.length)
  return new Blob([out], { type: 'image/jpeg' })
}

/**
 * PNGのpHYsチャンクにDPI情報を埋め込む
 * 既存のpHYsがある場合は置換、ない場合はIHDRの直後に挿入。
 */
async function injectDpiPng(blob: Blob, dpiX: number, dpiY: number): Promise<Blob> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)

  // pixels per meter に変換（1 inch = 0.0254 m）
  const ppmX = Math.round(dpiX / 0.0254)
  const ppmY = Math.round(dpiY / 0.0254)

  const phys = buildPHYsChunk(ppmX, ppmY)

  // PNG シグネチャ (8 bytes) + チャンクを走査
  let offset = 8
  let ihdrEnd = -1
  const chunks: { start: number; end: number; type: string }[] = []

  while (offset < bytes.length - 4) {
    const len = readUint32(bytes, offset)
    const type = String.fromCharCode(bytes[offset+4], bytes[offset+5], bytes[offset+6], bytes[offset+7])
    const chunkEnd = offset + 4 + 4 + len + 4  // length + type + data + crc
    chunks.push({ start: offset, end: chunkEnd, type })
    if (type === 'IHDR') ihdrEnd = chunkEnd
    offset = chunkEnd
  }

  if (ihdrEnd < 0) return blob  // 壊れたPNG

  // 既存pHYsを除去しつつIHDR直後にphysを挿入
  const parts: Uint8Array[] = [bytes.slice(0, ihdrEnd), phys]
  for (const chunk of chunks) {
    if (chunk.type === 'pHYs') continue  // 古いpHYsをスキップ
    if (chunk.start < ihdrEnd) continue  // IHDR以前は既に含まれている
    parts.push(bytes.slice(chunk.start, chunk.end))
  }

  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const p of parts) { out.set(p, pos); pos += p.length }
  return new Blob([out], { type: 'image/png' })
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 24 | bytes[offset+1] << 16 | bytes[offset+2] << 8 | bytes[offset+3]) >>> 0
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset]   = (value >>> 24) & 0xFF
  bytes[offset+1] = (value >>> 16) & 0xFF
  bytes[offset+2] = (value >>> 8) & 0xFF
  bytes[offset+3] = value & 0xFF
}

function buildPHYsChunk(ppmX: number, ppmY: number): Uint8Array {
  // pHYs data: ppux(4) + ppuy(4) + unit(1) = 9 bytes
  const data = new Uint8Array(9)
  writeUint32(data, 0, ppmX)
  writeUint32(data, 4, ppmY)
  data[8] = 0x01  // unit = meter

  const typeBytes = new Uint8Array([0x70, 0x48, 0x59, 0x73]) // "pHYs"
  const crc = crc32(new Uint8Array([...typeBytes, ...data]))

  const chunk = new Uint8Array(4 + 4 + 9 + 4)
  writeUint32(chunk, 0, 9)            // length
  chunk.set(typeBytes, 4)             // type
  chunk.set(data, 8)                  // data
  writeUint32(chunk, 17, crc)         // CRC
  return chunk
}

/** CRC32テーブルをその場で計算 */
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (const byte of data) {
    crc ^= byte
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

/**
 * CanvasをData URLに変換する（プレビュー用）
 */
export function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality = 0.92
): string {
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png'
  return format === 'jpg'
    ? canvas.toDataURL(mimeType, quality)
    : canvas.toDataURL(mimeType)
}

/**
 * OutputFormatからファイル拡張子を返す
 */
export function formatToExtension(format: OutputFormat): string {
  return format === 'jpg' ? '.jpg' : '.png'
}

/**
 * ファイル名の拡張子をOutputFormatに合わせて置換する
 */
export function replaceExtension(fileName: string, format: OutputFormat): string {
  const dotIndex = fileName.lastIndexOf('.')
  const base = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName
  return `${base}${formatToExtension(format)}`
}
