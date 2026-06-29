import { useState, useCallback } from 'react'
import { useAppStore } from '../store'
import type { OutputDestination } from '../types/output'
import { buildZipStream, saveZipStream, makeZipFileName } from '../utils/zip-builder'
import { saveEntriesToDirectory, supportsDirectoryExport } from '../utils/directory-builder'
import { buildOutputEntriesFromState } from '../utils/export-entries'

export interface UseExportResult {
  isExporting: boolean
  progress: number  // 0〜1
  error: string | null
  startExport: (destination?: OutputDestination) => Promise<void>
}

export function useExport(): UseExportResult {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const startExport = useCallback(async (destination: OutputDestination = 'zip') => {
    const state = useAppStore.getState()
    const {
      docWidth,
      docDpiX,
      docDpiY,
      psdFileName,
      psdSourceDirectory,
      xdtsSourceDirectory,
      outputConfig,
    } = state

    if (!psdFileName || docWidth === 0) {
      setError('PSD ファイルが読み込まれていません')
      return
    }

    setIsExporting(true)
    setProgress(0)
    setError(null)

    try {
      const defaultExportDirectory = psdSourceDirectory ?? xdtsSourceDirectory ?? undefined

      setProgress(0.1)

      // 全出力エントリを生成。displayName はツリー上に固定済みの XDTS trackNo
      // と手動指定分から計算される。
      const entries = buildOutputEntriesFromState(state)

      setProgress(0.4)

      setProgress(0.5)

      const handleEntryProgress = (done: number, total: number) => {
        // エントリ処理分 (0.5 → 0.95 の 0.45 幅) を done/total で案分
        setProgress(0.5 + 0.45 * (done / total))
      }

      if (destination === 'directory') {
        if (!supportsDirectoryExport()) {
          throw new Error('このブラウザではフォルダ書き出しに対応していません')
        }

        await saveEntriesToDirectory(
          entries,
          outputConfig,
          psdFileName,
          docDpiX,
          docDpiY,
          handleEntryProgress,
          defaultExportDirectory,
        )
      } else {
        // ZIP 生成: canvas → Blob 変換をエントリ 1 枚ずつ逐次化するストリーム。
        // buildZipStream 内部で canvas を release するため、ここで entries の canvas
        // 参照は処理済みになる(呼び出し後に entries を再利用しないこと)。
        const stream = buildZipStream(
          entries,
          outputConfig,
          docDpiX,
          docDpiY,
          handleEntryProgress,
        )

        // 保存: File System Access API が使えればネイティブ保存ダイアログから直接書き込み、
        // それ以外は Blob 化してから downloadBlob でフォールバック
        await saveZipStream(stream, makeZipFileName(psdFileName), defaultExportDirectory)
      }
      setProgress(1)
    } catch (e) {
      // ユーザが保存ダイアログをキャンセルした場合 (AbortError) はエラー表示せず silent 終了
      if (e instanceof DOMException && e.name === 'AbortError') {
        // 何も表示しない
        return
      }
      setError(e instanceof Error ? e.message : '出力に失敗しました')
    } finally {
      setIsExporting(false)
    }
  }, [])

  return { isExporting, progress, error, startExport }
}
