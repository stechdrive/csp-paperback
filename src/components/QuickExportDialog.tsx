import { useEffect, useRef, useState } from 'react'
import { isDesktopRuntime } from '../platform/runtime'
import { runQuickExportBatch, type QuickExportBatchResult, type QuickExportJobResult } from '../utils/quick-export'
import styles from './QuickExportDialog.module.css'

interface QuickExportDialogProps {
  paths: string[]
}

type QuickExportStatus = 'running' | 'done' | 'error'

async function configureQuickExportWindow(): Promise<void> {
  if (!isDesktopRuntime()) return

  const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window')
  const window = getCurrentWindow()
  await window.setTitle('CSP Paperback クイック書き出し')
  await window.setMinSize(new LogicalSize(480, 360))
  await window.setResizable(true)
  await window.setSize(new LogicalSize(640, 520))
  await window.center()
}

async function closeWindow(): Promise<void> {
  if (!isDesktopRuntime()) return

  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().close()
}

export function QuickExportDialog({ paths }: QuickExportDialogProps) {
  const startedRef = useRef(false)
  const [status, setStatus] = useState<QuickExportStatus>('running')
  const [message, setMessage] = useState('準備しています')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<QuickExportBatchResult | null>(null)
  const [jobs, setJobs] = useState<QuickExportJobResult[]>([])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    void (async () => {
      try {
        await configureQuickExportWindow()
        const quickResult = await runQuickExportBatch(paths, next => {
          setProgress(next.progress)
          setMessage(next.message)
          setJobs(next.results)
        })
        setResult(quickResult)
        setJobs(quickResult.jobs)
        setStatus('done')
        setProgress(1)
        setMessage(quickResult.failureCount ? '書き出しが終了しました。失敗した作品を確認してください' : '書き出しが完了しました')
      } catch (error) {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'クイック書き出しに失敗しました')
      }
    })()
  }, [paths])

  const canClose = status !== 'running'
  const percent = Math.round(progress * 100)
  const warningCount = jobs.filter(job => job.warnings.length > 0).length

  return (
    <div className={styles.shell}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="quick-export-title">
        <div className={styles.header}>
          <div id="quick-export-title" className={styles.title}>クイック書き出し</div>
          <div className={styles.status} role="status">
            {status === 'running' ? `${message} ${percent}%` : message}
            {result && <div>成功 {result.successCount}件／失敗 {result.failureCount}件／注意 {warningCount}件・計 {result.entryCount}枚</div>}
          </div>
        </div>
        <div className={styles.progressTrack} role="progressbar" aria-label="書き出し進捗" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div className={styles.progressFill} style={{ width: `${percent}%` }} />
        </div>
        <div className={styles.results} role="region" aria-label="作品ごとの書き出し結果" tabIndex={0}>
          {status === 'error' && <div className={`${styles.detail} ${styles.error}`} role="alert">{message}</div>}
          {jobs.length === 0 && status === 'running' && <p>作品ごとに読み込み、順番に書き出します。</p>}
          {jobs.map((job, index) => <div key={index} className={styles.detail} data-testid="quick-export-result">
            <strong className={job.status === 'error' ? styles.error : undefined}>
              {job.status === 'done' ? '成功' : '失敗'}：{job.sourcePath.split(/[\\/]/).at(-1)}
            </strong>
            <div>入力: {job.sourcePath}</div>
            {job.status === 'done'
              ? <><div>出力先: {job.outputDirectory}</div><div>枚数: {job.entryCount}</div></>
              : <div className={styles.error}>{job.error}</div>}
            {job.warnings.length > 0 && <details>
              <summary>注意 {job.warnings.length}件 — 再現状況を確認してください</summary>
              <ul>{job.warnings.map((warning, warningIndex) => <li key={warningIndex}>{warning}</li>)}</ul>
            </details>}
          </div>)}
        </div>
        <div className={styles.actions}>
          <button className={styles.button} type="button" disabled={!canClose} onClick={() => void closeWindow()}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
