import { useDismissableLayer } from '../hooks/useDismissableLayer'
import { Tooltip } from './Tooltip'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { OutputPreviewEntry } from '../hooks/useOutputPreview'
import { RenderWarning } from './RenderWarning'
import { DiagnosticWarning } from './DiagnosticWarning'
import styles from './PreviewPanel.module.css'

function positionFor(button: HTMLButtonElement) {
  const rect = button.getBoundingClientRect()
  const width = Math.min(480, window.innerWidth - 16)
  return {
    width,
    left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    bottom: window.innerHeight - rect.top + 6,
    maxHeight: Math.max(80, rect.top - 14),
  }
}

/** Keep names outside the canvas layout, including multi-output cells and long paths. */
export function OutputPreviewFiles({ entries, structure }: { entries: Omit<OutputPreviewEntry, 'canvas'>[]; structure: 'flat' | 'hierarchy' }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState<ReturnType<typeof positionFor> | null>(null)
  const open = position !== null
  const names = entries.map(entry => structure === 'hierarchy' ? entry.path || entry.flatName : entry.flatName)
  useDismissableLayer({ open, content: popup, trigger,
    initialFocus: () => close.current,
    onDismiss: reason => { setPosition(null); if (reason === 'escape') trigger.current?.focus({ preventScroll: true }) } })
  useEffect(() => {
    if (!open) return
    const reposition = () => { if (trigger.current) setPosition(positionFor(trigger.current)) }
    const observer = new ResizeObserver(reposition)
    if (trigger.current) observer.observe(trigger.current)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])
  const vector = entries.some(entry => entry.vectorWarning)
  const unsupported3D = entries.some(entry => entry.unsupported3D)
  return <div className={styles.fileNames} data-testid="preview-files">
    <Tooltip content={names.join('\n')}><button data-tooltip={names.join('\n')} ref={trigger} type="button" className={styles.fileNameButton}
      aria-label={`プレビュー中のファイル名（${entries.length}件）`} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? id : undefined}
      onClick={() => setPosition(open || !trigger.current ? null : positionFor(trigger.current))}>
      <span className={styles.fileNameText} data-testid="preview-file-name">{names[0]}</span>
      {entries.length > 1 && <span className={styles.previewFileCount}>{entries.length}件</span>}
    </button></Tooltip>
    {entries.some(entry => entry.diagnostics) ? <DiagnosticWarning issues={entries.flatMap(entry => entry.diagnostics ?? [])} />
      : (vector || unsupported3D) && <RenderWarning vector={vector} unsupported3D={unsupported3D} sourceIds={entries.flatMap(entry => [...(entry.sources?.all ?? [])])} />}
    {position && createPortal(<div ref={popup} id={id} role="dialog" aria-label="プレビュー中のファイル名" className={styles.settingsPopup} style={position}>
      <div className={styles.settingsHeader}>
        <strong>プレビュー中のファイル · {entries.length}件</strong>
        <button ref={close} type="button" className={styles.iconButton} aria-label="ファイル名を閉じる" onClick={() => { setPosition(null); trigger.current?.focus() }}>✕</button>
      </div>
      <ol className={styles.previewFileList}>
        {entries.map((entry, index) => <li key={index}>
          <span>{names[index]}</span>
          {entry.diagnostics ? <DiagnosticWarning issues={entry.diagnostics} />
            : (entry.vectorWarning || entry.unsupported3D) && <RenderWarning vector={entry.vectorWarning} unsupported3D={entry.unsupported3D} sourceIds={entry.sources?.all} />}
        </li>)}
      </ol>
    </div>, document.body)}
  </div>
}
