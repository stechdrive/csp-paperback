import { useEffect, useRef, useState } from 'react'
import { isDesktopRuntime } from '../platform/runtime'
import { runQuickExport, type QuickExportResult } from '../utils/quick-export'
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
  await window.setResizable(false)
  await window.setSize(new LogicalSize(460, 300))
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
  const [result, setResult] = useState<QuickExportResult | null>(null)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    void (async () => {
      try {
        await configureQuickExportWindow()
        const quickResult = await runQuickExport(paths, next => {
          setProgress(next.progress)
          setMessage(next.message)
        })
        setResult(quickResult)
        setStatus('done')
        setProgress(1)
        setMessage('書き出しが完了しました')
      } catch (error) {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'クイック書き出しに失敗しました')
      }
    })()
  }, [paths])

  const canClose = status !== 'running'
  const percent = Math.round(progress * 100)
  const detail = status === 'done' && result
    ? `出力先: ${result.outputDirectory}\n枚数: ${result.entryCount}`
    : message

  return (
    <div className={styles.shell}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="quick-export-title">
        <div className={styles.header}>
          <div id="quick-export-title" className={styles.title}>クイック書き出し</div>
          <div className={styles.status}>
            {status === 'running' ? `${message} ${percent}%` : message}
          </div>
        </div>
        <div className={styles.progressTrack} aria-label="書き出し進捗">
          <div className={styles.progressFill} style={{ width: `${percent}%` }} />
        </div>
        <div className={`${styles.detail} ${status === 'error' ? styles.error : ''}`}>
          {detail.split('\n').map((line, index) => (
            <div key={index}>{line}</div>
          ))}
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
