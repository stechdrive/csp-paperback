import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { OutputPreviewEntry } from '../hooks/useOutputPreview'
import { RenderWarning } from './RenderWarning'
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
export function OutputPreviewFiles({ entries, structure }: { entries: OutputPreviewEntry[]; structure: 'flat' | 'hierarchy' }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState<ReturnType<typeof positionFor> | null>(null)
  const open = position !== null
  const names = entries.map(entry => structure === 'hierarchy' ? entry.path || entry.flatName : entry.flatName)
  useEffect(() => {
    if (!open) return
    close.current?.focus()
    const outside = (event: Event) => {
      if (event.target instanceof Node && !popup.current?.contains(event.target) && !trigger.current?.contains(event.target)) setPosition(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setPosition(null)
      trigger.current?.focus()
    }
    const reposition = () => { if (trigger.current) setPosition(positionFor(trigger.current)) }
    const observer = new ResizeObserver(reposition)
    if (trigger.current) observer.observe(trigger.current)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      observer.disconnect()
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])
  const vector = entries.some(entry => entry.vectorWarning)
  const unsupported3D = entries.some(entry => entry.unsupported3D)
  return <div className={styles.fileNames} data-testid="preview-files">
    <button ref={trigger} type="button" className={styles.fileNameButton} title={names.join('\n')}
      aria-label={`プレビュー中のファイル名（${entries.length}件）`} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? id : undefined}
      onClick={() => setPosition(open || !trigger.current ? null : positionFor(trigger.current))}>
      <span className={styles.fileNameText} data-testid="preview-file-name" title={names[0]}>{names[0]}</span>
      {entries.length > 1 && <span className={styles.previewFileCount}>{entries.length}件</span>}
    </button>
    {(vector || unsupported3D) && <RenderWarning vector={vector} unsupported3D={unsupported3D} />}
    {position && createPortal(<div ref={popup} id={id} role="dialog" aria-label="プレビュー中のファイル名" className={styles.settingsPopup} style={position}>
      <div className={styles.settingsHeader}>
        <strong>プレビュー中のファイル · {entries.length}件</strong>
        <button ref={close} type="button" className={styles.iconButton} aria-label="ファイル名を閉じる" onClick={() => { setPosition(null); trigger.current?.focus() }}>✕</button>
      </div>
      <ol className={styles.previewFileList}>
        {entries.map((entry, index) => <li key={index}>
          <span>{names[index]}</span>
          {(entry.vectorWarning || entry.unsupported3D) && <RenderWarning vector={entry.vectorWarning} unsupported3D={entry.unsupported3D} />}
        </li>)}
      </ol>
    </div>, document.body)}
  </div>
}
