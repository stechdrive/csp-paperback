import { decodeLayerPixels, readPsd } from 'ag-psd'
import type { Layer, Psd } from 'ag-psd'
import { Inflate } from 'pako'
import { ImageBudget, imageBytes, MAX_INPUT_BYTES, MAX_LAYER_COUNT, MAX_LAYER_DEPTH } from './image-budget'
import { ownMaterials, registerMaterial } from '../engine/material-cache'

function dimensions(rect: { left?: number; right?: number; top?: number; bottom?: number }): [number, number] {
  return [(rect.right ?? 0) - (rect.left ?? 0), (rect.bottom ?? 0) - (rect.top ?? 0)]
}

/** ag-psd's ZIP decoder inflates without a size limit. Check the stream without retaining its output. */
function checkZipChannels(layer: Layer): void {
  const raw = layer.rawData
  if (!raw) return
  for (const channel of raw.channels) {
    if (!channel.data || (channel.compression !== 2 && channel.compression !== 3)) continue
    const rect = channel.id === -2 ? layer.mask : channel.id === -3 ? layer.realMask : layer
    if (!rect) throw new Error('PSDのマスク情報がありません')
    const [width, height] = dimensions(rect)
    const expected = imageBytes(width, height, raw.bitsPerChannel / 8)
    let decoded = 0
    const inflate = new Inflate({ chunkSize: 64 * 1024 })
    inflate.onData = chunk => {
      decoded += (chunk as Uint8Array).byteLength
      if (decoded > expected) throw new Error('PSDの圧縮画像が指定寸法を超えています')
    }
    inflate.push(channel.data, true)
    if (inflate.err || decoded !== expected) throw new Error('PSDの圧縮画像の長さが不正です')
  }
}

/**
 * ArrayBufferからPSDを読み込む
 * canvas要素としてレイヤーデータを取得（useImageData: false）
 * compositeImageData（結合済み画像）はスキップしてメモリ節約
 */
export function readPsdFile(buffer: ArrayBuffer, lazy = false): Psd {
  if (buffer.byteLength > MAX_INPUT_BYTES) throw new Error('PSDファイルは1 GiBまで読み込めます')
  if (buffer.byteLength < 26) throw new Error('PSDヘッダーが不正です')
  const header = new DataView(buffer)
  imageBytes(header.getUint32(18), header.getUint32(14))
  new ImageBudget().reserve(header.getUint32(18), header.getUint32(14), 4 * Math.max(1, header.getUint16(22) / 8))
  // Keep compressed channel views until the complete hierarchy has passed the budget check.
  const psd = readPsd(buffer, {
    useRawData: true,
    skipCompositeImageData: true,
    skipThumbnail: true,
    skipLinkedFilesData: true,
  })
  const budget = new ImageBudget(), layers: Layer[] = []
  const stack = (psd.children ?? []).map(layer => ({ layer, depth: 1 }))
  while (stack.length) {
    const { layer, depth } = stack.pop()!
    if (depth > MAX_LAYER_DEPTH || layers.length >= MAX_LAYER_COUNT) throw new Error('PSDのレイヤー数または階層が上限を超えました')
    // Include the decode working buffer at the document's bit depth, and both mask kinds.
    const bytesPerPixel = 4 * Math.max(1, (psd.bitsPerChannel ?? 8) / 8)
    const layerBudget = lazy ? new ImageBudget() : budget
    for (const rect of [layer, layer.mask, layer.realMask]) if (rect) layerBudget.reserve(...dimensions(rect), bytesPerPixel)
    layers.push(layer)
    for (const child of layer.children ?? []) stack.push({ layer: child, depth: depth + 1 })
  }
  if (lazy) {
    const disposers = layers.map(layer => {
      const estimate = [layer, layer.mask, layer.realMask].reduce((n, rect) => {
        if (!rect) return n
        const [width, height] = dimensions(rect)
        return n + width * height * 4
      }, 0)
      return registerMaterial(layer, estimate, async () => {
        // decodeLayerPixels deletes rawData. Decode a shallow adapter so the
        // original compressed channels survive eviction and can be reloaded.
        const decoded: Layer = { ...layer, mask: layer.mask && { ...layer.mask }, realMask: layer.realMask && { ...layer.realMask } }
        checkZipChannels(decoded)
        decodeLayerPixels(decoded)
        layer.canvas = decoded.canvas
        if (decoded.mask) layer.mask = decoded.mask
        if (decoded.realMask) layer.realMask = decoded.realMask
        return { diagnostics: [] }
      })
    })
    ownMaterials(psd, () => disposers.forEach(dispose => dispose()))
    return psd
  }
  try {
    for (const layer of layers) { checkZipChannels(layer); decodeLayerPixels(layer) }
    return psd
  } catch (error) {
    // A failed import must release already decoded pixels, without touching the current project.
    for (const layer of layers) for (const item of [layer, layer.mask, layer.realMask]) {
      if (item?.canvas) { item.canvas.width = 1; item.canvas.height = 1 }
    }
    throw error
  }
}
