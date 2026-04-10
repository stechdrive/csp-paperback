import { readPsd } from 'ag-psd'
import type { Psd } from 'ag-psd'

/**
 * ArrayBufferからPSDを読み込む
 * canvas要素としてレイヤーデータを取得（useImageData: false）
 * compositeImageData（結合済み画像）はスキップしてメモリ節約
 */
export function readPsdFile(buffer: ArrayBuffer): Psd {
  return readPsd(buffer, {
    skipCompositeImageData: true,
    skipThumbnail: true,
  })
}
