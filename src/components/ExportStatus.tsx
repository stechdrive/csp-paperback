import { useEffect, useRef } from 'react'
import { dismissExportStatus, isExportInProgress, useExportJob } from '../store/export-job'
import styles from './ExportStatus.module.css'

export function ExportStatus() {
  const job = useExportJob()
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!job.isExporting) return
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus({ preventScroll: true })
    // Portalled menus and global shortcuts obey the same lock as inert.
    const block = (event: Event) => {
      if (!isExportInProgress()) return
      if (event.target instanceof Element && event.target.closest('[data-export-conflict]')) return
      if (event.target instanceof Node && panel.current?.contains(event.target)) return
      event.preventDefault(); event.stopImmediatePropagation()
    }
    const events = ['pointerdown', 'click', 'contextmenu', 'keydown', 'wheel', 'dragover', 'drop']
    events.forEach(name => window.addEventListener(name, block, { capture: true, passive: false }))
    return () => {
      events.forEach(name => window.removeEventListener(name, block, true))
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [job.isExporting])
  useEffect(() => {
    if (job.isExporting || job.warnings?.length || !['done', 'cancelled'].includes(job.phase)) return
    const timer = setTimeout(dismissExportStatus, job.phase === 'done' ? 6000 : 2500)
    return () => clearTimeout(timer)
  }, [job.isExporting, job.phase, job.warnings])
  if (job.phase === 'idle') return null
  const title = job.phase === 'done' ? '書き出しました' : job.phase === 'cancelled' ? '書き出しをキャンセルしました'
    : job.phase === 'error' ? '書き出しできませんでした' : '書き出し中'
  const phase = { idle: '', waiting: '保存先を選択してください', rendering: '画像を合成しています', encoding: '画像を変換しています', writing: '保存しています', saving: '保存を仕上げています', done: '', cancelled: '', error: '' }[job.phase]
  const percent = Math.floor(job.progress * 100)
  return <section ref={panel} className={styles.status} data-testid="export-status" data-phase={job.phase} tabIndex={-1} aria-label="書き出しの進捗">
    <div className={styles.heading}>
      <span className={styles.indicator} aria-hidden="true">{job.phase === 'done' ? '✓' : job.phase === 'error' ? '!' : '↗'}</span>
      <strong role={job.phase === 'error' ? 'alert' : 'status'}>{title}</strong>
      <span className={styles.source}>{job.sourceName} · {job.destination === 'psd' ? 'PSD' : job.destination === 'zip' ? 'ZIP' : job.destination === 'directory-flat' ? '直接書き出し' : 'フォルダ'}</span>
      <span className={styles.count}>{job.done} / {job.total}枚</span>
      {!job.isExporting && <button type="button" onClick={dismissExportStatus} aria-label="書き出し状況を閉じる">×</button>}
    </div>
    <div className={styles.details}>
      <span>{job.error ?? phase}</span><span className={styles.file}>{job.currentFile}</span>
      {job.isExporting && <span className={styles.percent}>{percent}%</span>}
    </div>
    {!!job.warnings?.length && <ul>{job.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
    {job.isExporting && <div className={styles.track} role="progressbar" aria-label="書き出し" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${phase} ${job.done} / ${job.total}枚 ${job.currentFile}`}>
      <div className={styles.fill} style={{ width: `${percent}%` }} />
    </div>}
  </section>
}
