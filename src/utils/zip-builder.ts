import JSZip from 'jszip'
import type { OutputEntry, OutputConfig } from '../types'
import { canvasToBlob, replaceExtension } from './image-export'
import { resolveEntryNames } from './naming'

/**
 * OutputEntry[] をZIPとしてパッケージングしてBlobを返す
 *
 * @param entries 出力エントリ一覧
 * @param config  出力設定（フォーマット・構造モード等）
 * @param psdFileName PSDファイル名（ZIPファイル名の基になる）
 */
export async function buildZip(
  entries: OutputEntry[],
  config: OutputConfig,
  _psdFileName: string,
  dpiX = 0,
  dpiY = 0,
): Promise<Blob> {
  const zip = new JSZip()

  // ファイル名衝突解決
  // 拡張子をOutputFormatに合わせてから衝突解決
  const normalizedEntries = entries.map(e => ({
    ...e,
    path: replaceExtension(e.path, config.format),
    flatName: replaceExtension(e.flatName, config.format),
  }))
  const resolved = resolveEntryNames(normalizedEntries)

  // 各エントリをCanvasからBlobに変換してZIPに追加
  await Promise.all(
    resolved.map(async (entry, i) => {
      const blob = await canvasToBlob(entries[i].canvas, config.format, config.jpgQuality, dpiX, dpiY)

      const zipPath =
        config.structure === 'hierarchy' ? entry.path : entry.flatName

      zip.file(zipPath, blob)
    })
  )

  return zip.generateAsync({ type: 'blob' })
}

/**
 * ZIPのファイル名を生成する（PSDファイル名から拡張子除去）
 */
export function makeZipFileName(psdFileName: string): string {
  const dotIndex = psdFileName.lastIndexOf('.')
  const base = dotIndex >= 0 ? psdFileName.slice(0, dotIndex) : psdFileName
  return `${base}.zip`
}

/**
 * ZIPBlobをブラウザでダウンロードさせる
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
