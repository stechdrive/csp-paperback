import type { OutputFormat } from '../types'

/**
 * CanvasをBlobに変換する
 * @param canvas 変換元キャンバス
 * @param format 'jpg' | 'png'
 * @param quality JPGの場合の品質 (0.0〜1.0)
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png'
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error(`Failed to convert canvas to ${format} blob`))
        }
      },
      mimeType,
      format === 'jpg' ? quality : undefined
    )
  })
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
