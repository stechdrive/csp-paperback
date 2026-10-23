import { loadProjectFiles } from './project-loader'
import { useAppStore } from '../store'
import { allowTauriLaunchFilePaths, loadableFilesFromPaths } from '../platform/files'
import { planExportEntriesFromState } from './export-entries'
import { trackExportDiagnostics } from './export-diagnostics'
import { saveEntriesToDirectoryPath } from './directory-builder'
import { resolveQuickExportFilePair, resolveQuickExportJobs, type QuickExportFilePair } from './quick-export-plan'
import { DirectoryExportSession, type ConfirmExportConflict } from './directory-export-session'
import { confirmExportConflict } from '../store/export-conflict'
import type { DirectoryExportMode } from '../types/output'
export { resolveQuickExportFilePair, resolveQuickExportJobs } from './quick-export-plan'

export interface QuickExportProgress {
  progress: number
  message: string
}

export interface QuickExportResult {
  outputDirectory: string
  entryCount: number
  warnings: string[]
}

export type QuickExportJobResult = { sourcePath: string; warnings: string[] } & (
  | ({ status: 'done' } & QuickExportResult)
  | { status: 'error' | 'cancelled'; error: string }
)

export interface QuickExportBatchResult {
  cancelled: boolean
  jobs: QuickExportJobResult[]
  successCount: number
  failureCount: number
  entryCount: number
}

export interface QuickExportBatchProgress extends QuickExportProgress {
  results: QuickExportJobResult[]
}

export async function runQuickExport(
  paths: string[],
  onProgress: (progress: QuickExportProgress) => void,
  confirm: ConfirmExportConflict = confirmExportConflict,
): Promise<QuickExportResult> {
  const pair = resolveQuickExportFilePair(paths)
  if (!pair) {
    throw new Error('クイック書き出し用のCLIPまたはPSD＋XDTSが見つかりませんでした')
  }
  await allowTauriLaunchFilePaths()
  return exportPair(pair, onProgress, useAppStore.getState().directoryExportMode ?? 'subfolder', new DirectoryExportSession(confirm))
}

async function exportPair(pair: QuickExportFilePair, onProgress: (progress: QuickExportProgress) => void,
  mode: DirectoryExportMode, session: DirectoryExportSession): Promise<QuickExportResult> {
  onProgress({ progress: 0.05, message: 'ファイルを確認しています' })

  const { dirname } = await import('@tauri-apps/api/path')
  const outputParent = await dirname(pair.clipPath ?? pair.xdtsPath!)

  const files = await loadableFilesFromPaths([pair.clipPath, pair.xdtsPath, pair.psdPath].filter((p): p is string => !!p))
  onProgress({ progress: 0.12, message: '素材とタイムラインを読み込んでいます' })
  await loadProjectFiles(files)
  const loadedState = useAppStore.getState()
  const sourceName = loadedState.clipFileName ?? loadedState.psdFileName
  if (!sourceName || loadedState.docWidth === 0) throw new Error('素材ファイルが読み込まれていません')

  onProgress({ progress: 0.38, message: '出力一覧を準備しています' })
  const outputConfig = mode === 'direct-flat' ? { ...loadedState.savedOutputConfig, structure: 'flat' as const } : loadedState.savedOutputConfig
  const planned = planExportEntriesFromState(loadedState, outputConfig)
  if (planned.length === 0) {
    throw new Error('出力対象がありません')
  }
  const tracked = trackExportDiagnostics(planned, loadedState.clipDiagnostics, outputConfig, loadedState.layerTree)
  const entries = tracked.entries

  onProgress({ progress: 0.5, message: '入力ファイルと同じ場所へ書き出しています' })
  const outputDirectory = await saveEntriesToDirectoryPath(
    entries,
    outputConfig,
    sourceName,
    outputParent,
    loadedState.docDpiX,
    loadedState.docDpiY,
    (done, total, detail) => {
      onProgress({
        progress: 0.5 + 0.45 * (done / total),
        message: detail ? `${detail.phase === 'rendering' ? '合成中' : detail.phase === 'encoding' ? '画像変換中' : '保存中'} ${done + 1}/${total} ${detail.path}`
          : `書き出し中 ${done}/${total}`,
      })
    },
    { mode, session },
  )

  onProgress({ progress: 1, message: '完了しました' })

  return {
    outputDirectory,
    entryCount: entries.length,
    warnings: tracked.messages(),
  }
}

/** Process one document at a time, releasing canvases and restoring saved settings between jobs. */
export async function runQuickExportBatch(
  paths: string[],
  onProgress: (progress: QuickExportBatchProgress) => void,
  confirm: ConfirmExportConflict = confirmExportConflict,
): Promise<QuickExportBatchResult> {
  const jobs = resolveQuickExportJobs(paths)
  if (!jobs.length) throw new Error('クイック書き出し用のCLIPまたはPSD＋XDTSが見つかりませんでした')
  const projectSettings = structuredClone(useAppStore.getState().projectSettings)
  const savedOutputConfig = structuredClone(useAppStore.getState().savedOutputConfig)
  const mode = useAppStore.getState().directoryExportMode ?? 'subfolder'
  const session = new DirectoryExportSession(confirm, jobs.length > 1)
  let cancelled = false
  const results: QuickExportJobResult[] = []
  const reset = () => {
    useAppStore.getState().resetProject()
    useAppStore.setState({
      projectSettings: structuredClone(projectSettings),
      savedOutputConfig: structuredClone(savedOutputConfig),
      outputConfig: structuredClone(savedOutputConfig),
    })
  }
  if (jobs.some(job => job.pair)) await allowTauriLaunchFilePaths()
  try {
    for (const [index, job] of jobs.entries()) {
      reset()
      const name = job.sourcePath.split(/[\\/]/).at(-1) ?? job.sourcePath
      const report = (progress: QuickExportProgress) => onProgress({
        progress: (index + progress.progress) / jobs.length,
        message: `${index + 1}/${jobs.length} ${name} — ${progress.message}`,
        results: [...results],
      })
      report({ progress: 0, message: '準備しています' })
      try {
        if (!job.pair) throw new Error(job.error)
        const result = await exportPair(job.pair, report, mode, session)
        results.push({ sourcePath: job.sourcePath, status: 'done', ...result })
      } catch (error) {
        cancelled = error instanceof DOMException && error.name === 'AbortError'
        results.push({ sourcePath: job.sourcePath, status: cancelled ? 'cancelled' : 'error',
          error: error instanceof Error ? error.message : String(error),
          warnings: [...new Set(useAppStore.getState().clipDiagnostics.map(d => d.message))],
        })
      } finally {
        reset()
      }
      report({ progress: 1, message: cancelled ? 'キャンセルしました' : results.at(-1)!.status === 'done' ? '完了しました' : '失敗しました' })
      if (cancelled) break
    }
  } finally {
    reset()
  }
  return {
    cancelled,
    jobs: results,
    successCount: results.filter(r => r.status === 'done').length,
    failureCount: results.filter(r => r.status === 'error').length,
    entryCount: results.reduce((sum, r) => sum + (r.status === 'done' ? r.entryCount : 0), 0),
  }
}
