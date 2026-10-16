import { makeZip } from 'client-zip'
import type { ExportEntry, OutputConfig, ExportProgressCallback } from '../types/output'
import { createAbortError, isDesktopRuntime } from '../platform/runtime'
import { prepareOutputEntries, streamOutputEntries } from './output-builder'

/**
 * ZIP 出力パイプライン
 *
 * 設計方針:
 * - 旧実装は JSZip で全 canvas を一度に Blob 化してから zip を作っていたため、
 *   エントリ数 × canvas メモリのピークが発生していた(1920x1080 RGBA ≒ 8MB × 数百枚)。
 * - 新実装は client-zip の AsyncIterable ベース API を使い、canvas → Blob 変換を
 *   エントリ 1 枚ずつ逐次化。変換後すぐに canvas 参照を切って GC 可能にする。
 * - ZIP は JPEG/PNG のみ内包するため STORE モード固定(client-zip は STORE only)。
 *   既に圧縮済みのメディアファイルに再 deflate は無意味なので理想的な選択。
 * - 出力先:
 *   - File System Access API (showSaveFilePicker) が使える環境 → ネイティブ保存ダイアログから
 *     選ばれた場所に pipeTo で直接ストリーミング書き込み。メモリは canvas 1 枚分で constant。
 *   - 未対応環境(Firefox 等) → Response 経由で Blob 化してから downloadBlob で保存。
 *     こちらも canvas を抱え続けないので旧実装よりピークは大幅改善。
 */

/**
 * ExportEntry[] から ZIP の ReadableStream を返す。
 *
 * 生成は遅延評価で、下流(pipeTo や Response)が読んだタイミングで
 * エントリ 1 枚ずつ canvas → Blob 変換 → zip chunk 生成が進む。
 * メモリピークは「1 枚の canvas + client-zip 内部バッファ」程度に抑えられる。
 */
export function buildZipStream(
  entries: ExportEntry[],
  config: OutputConfig,
  dpiX = 0,
  dpiY = 0,
  onProgress?: ExportProgressCallback,
): ReadableStream<Uint8Array> {
  const preparedEntries = prepareOutputEntries(entries, config)

  const generate = async function* () {
    for await (const entry of streamOutputEntries(
      preparedEntries,
      entries,
      config,
      dpiX,
      dpiY,
      onProgress,
    )) {
      yield { name: entry.relativePath, input: entry.input }
    }
  }
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      reader ??= makeZip(generate()).getReader()
      const { done, value } = await reader.read()
      if (done) { reader.releaseLock(); controller.close() }
      else controller.enqueue(value)
    },
    async cancel(reason) { await reader?.cancel(reason) },
  }, { highWaterMark: 0 })
}

/**
 * ZIP ReadableStream をユーザのファイルシステムに保存する。
 *
 * File System Access API (showSaveFilePicker) が使える環境では、
 * ネイティブ保存ダイアログで選ばれた場所に pipeTo で直接書き込む。
 * 使えない環境では Response 経由で Blob を作ってから downloadBlob にフォールバック。
 *
 * ユーザが保存ダイアログをキャンセルした場合は AbortError を throw する。
 * 呼び出し側は AbortError を「ユーザ操作による中断」として扱い、
 * エラーメッセージを出さずに silently 終了するのが望ましい。
 */
export async function saveZipStream(
  stream: ReadableStream<Uint8Array>,
  fileName: string,
  defaultDirectory?: string,
): Promise<void> {
  if (isDesktopRuntime()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { open } = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')
    const defaultPath = defaultDirectory ? await join(defaultDirectory, fileName) : fileName
    const path = await save({
      title: 'ZIPを書き出す',
      defaultPath,
      filters: [{ name: 'ZIP archive', extensions: ['zip'] }],
    })
    if (path === null) { await stream.cancel(); throw createAbortError() }

    // The plugin's writeFile(stream) opens without truncating existing files.
    // A shorter ZIP would leave the old central directory at the end.
    const file = await open(path, { write: true, create: true, truncate: true })
    try {
      await stream.pipeTo(new WritableStream<Uint8Array>({
        async write(chunk) {
          let offset = 0
          while (offset < chunk.length) {
            const written = await file.write(chunk.subarray(offset))
            if (written <= 0) throw new Error('ZIPファイルに書き込めませんでした')
            offset += written
          }
        },
      }))
    } finally { await file.close() }
    return
  }

  type ShowSaveFilePicker = (options?: {
    suggestedName?: string
    types?: Array<{ description?: string; accept: Record<string, string[]> }>
  }) => Promise<FileSystemFileHandle>

  const fsPicker = (window as unknown as { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker

  if (typeof fsPicker === 'function') {
    // Chrome/Edge/Opera: ネイティブ保存ダイアログ + pipeTo でストリーミング書き込み
    try {
      const handle = await fsPicker({
        suggestedName: fileName,
        types: [{
          description: 'ZIP archive',
          accept: { 'application/zip': ['.zip'] },
        }],
      })
      const writable = await handle.createWritable()
      await stream.pipeTo(writable)
      return
    } catch (e) {
      // ユーザキャンセルはそのまま呼び出し側に伝播(呼び出し側が silent 扱いする)
      if (!stream.locked) await stream.cancel().catch(() => {})
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      // その他のエラーはそのまま伝播(stream が consume 済みの可能性があり安全に fallback 不可)
      throw e
    }
  }

  // Firefox 等 feature 未対応環境: Blob 化してから downloadBlob で保存
  const response = new Response(stream)
  const blob = await response.blob()
  downloadBlob(blob, fileName)
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
 * Blob をブラウザのダウンロードとして保存する(フォールバック用)
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
