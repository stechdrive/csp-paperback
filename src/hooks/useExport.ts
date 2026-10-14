import { useCallback } from 'react'
import { useAppStore } from '../store'
import { useExportJob, isExportInProgress } from '../store/export-job'
import type { OutputDestination, ExportProgressCallback } from '../types/output'
import { buildZipStream, saveZipStream, makeZipFileName } from '../utils/zip-builder'
import { saveEntriesToDirectory, supportsDirectoryExport } from '../utils/directory-builder'
import { planExportEntriesFromState } from '../utils/export-entries'
import { outputRenderQueue } from '../utils/output-render-queue'

export interface UseExportResult {
  isExporting: boolean
  progress: number
  error: string | null
  startExport: (destination?: OutputDestination, selectedIds?: ReadonlySet<string>) => Promise<void>
}

export function useExport(observeProgress = true): UseExportResult {
  const isExporting = useExportJob(s => s.isExporting)
  const progress = useExportJob(s => observeProgress ? s.progress : 0)
  const error = useExportJob(s => s.error)
  const startExport = useCallback(async (destination: OutputDestination = 'zip', selectedIds?: ReadonlySet<string>) => {
    if (isExportInProgress()) return
    const state = useAppStore.getState()
    const sourceName = state.clipFileName ?? state.psdFileName
    if (!sourceName || !state.docWidth) {
      useExportJob.setState({ phase: 'error', error: 'CLIP / PSD ファイルが読み込まれていません' })
      return
    }
    useExportJob.setState({ isExporting: true, phase: 'waiting', progress: 0, done: 0, total: 0,
      currentFile: '', sourceName, destination, error: null })
    const resumePreviews = outputRenderQueue.pause()
    let stream: ReadableStream<Uint8Array> | undefined
    try {
      const entries = planExportEntriesFromState(state, state.outputConfig, selectedIds ? new Set(selectedIds) : undefined)
      if (!entries.length) throw new Error('選択した項目に書き出せる画像がありません')
      useExportJob.setState({ total: entries.length })
      const onProgress: ExportProgressCallback = (done, total, detail) => {
        const fraction = detail?.phase === 'encoding' ? .5 : detail?.phase === 'writing' ? .85 : 0
        useExportJob.setState({ done, total, progress: .98 * (done + fraction) / Math.max(1, total),
          ...(detail ? { currentFile: detail.path, phase: detail.phase } : {}),
          ...(done === total ? { phase: 'saving' as const } : {}) })
      }
      const directory = state.clipSourceDirectory ?? state.psdSourceDirectory ?? state.xdtsSourceDirectory ?? undefined
      // Preserve user activation for the native picker; pixels are rendered on consumption.
      if (destination === 'directory') {
        if (!supportsDirectoryExport()) throw new Error('このブラウザではフォルダ書き出しに対応していません')
        await saveEntriesToDirectory(entries, state.outputConfig, sourceName, state.docDpiX, state.docDpiY, onProgress, directory)
      } else {
        stream = buildZipStream(entries, state.outputConfig, state.docDpiX, state.docDpiY, onProgress)
        await saveZipStream(stream, makeZipFileName(sourceName), directory)
      }
      useExportJob.setState({ phase: 'done', done: entries.length, progress: 1 })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') useExportJob.setState({ phase: 'cancelled' })
      else useExportJob.setState({ phase: 'error', error: error instanceof Error ? error.message : '出力に失敗しました' })
    } finally {
      if (stream && !stream.locked) await stream.cancel().catch(() => {})
      useExportJob.setState({ isExporting: false })
      resumePreviews()
    }
  }, [])
  return { isExporting, progress, error, startExport }
}
