/** Limits apply before allocating pixels, including canvases created after decoding. */
export const MAX_INPUT_BYTES = 1024 * 1024 * 1024
export const MAX_IMAGE_PIXELS = 64 * 1024 * 1024
export const MAX_SOURCE_BYTES = 512 * 1024 * 1024
export const MAX_LAYER_DEPTH = 128
export const MAX_LAYER_COUNT = 50_000

export function imageBytes(width: number, height: number, bytesPerPixel = 4): number {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 0 || height < 0 ||
    width * height > MAX_IMAGE_PIXELS) throw new Error('画像の寸法が範囲外です（1枚64メガピクセルまで）')
  return width * height * bytesPerPixel
}

export class ImageBudget {
  private bytes = 0
  private readonly limit: number
  constructor(limit = MAX_SOURCE_BYTES) { this.limit = limit }
  reserve(width: number, height: number, bytesPerPixel = 4): void {
    const bytes = imageBytes(width, height, bytesPerPixel)
    if (this.bytes + bytes > this.limit) throw new Error('画像展開の合計が512 MiBを超えました')
    this.bytes += bytes
  }
}
