import { useDismissableLayer } from '../hooks/useDismissableLayer'
import { Tooltip } from './Tooltip'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../store'
import type { ClipDiagnostic } from '../utils/clip/types'
import styles from './ClipPreviewControls.module.css'

function popupPosition(button: HTMLButtonElement) {
  const bounds = button.getBoundingClientRect()
  const margin = 12
  const width = Math.min(420, window.innerWidth - margin * 2)
  const top = bounds.bottom + 6
  return {
    top,
    left: Math.max(margin, Math.min(bounds.right - width, window.innerWidth - width - margin)),
    width,
    maxHeight: Math.min(360, window.innerHeight - top - margin),
  }
}

function Diagnostics({ items }: { items: ClipDiagnostic[] }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState<ReturnType<typeof popupPosition> | null>(null)
  const open = position !== null

  useDismissableLayer({ open, content: popup, trigger,
    initialFocus: () => closeButton.current,
    onDismiss: reason => { setPosition(null); if (reason === 'escape') trigger.current?.focus({ preventScroll: true }) } })
  useEffect(() => {
    if (!open) return
    const reposition = () => {
      if (trigger.current) setPosition(popupPosition(trigger.current))
    }
    const observer = new ResizeObserver(reposition)
    if (trigger.current?.parentElement) observer.observe(trigger.current.parentElement)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  return <>
    <Tooltip content={`再現状況 ${items.length}件`}><button data-tooltip={`再現状況 ${items.length}件`}
      ref={trigger}
      type="button"
      className={styles.trigger}
      aria-label={`再現状況 ${items.length}件`}
      aria-expanded={open}
      aria-controls={open ? id : undefined}
      aria-haspopup="dialog"
      onClick={() => setPosition(open || !trigger.current ? null : popupPosition(trigger.current))}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 3v1" /></svg>
      <span className={styles.triggerLabel}>再現状況 {items.length}件</span>
    </button></Tooltip>
    {position && createPortal(
      <div ref={popup} id={id} className={styles.popup} style={position} role="dialog" aria-labelledby={`${id}-title`}>
        <div className={styles.popupHeader}>
          <strong id={`${id}-title`}>再現状況 {items.length}件</strong>
          <button ref={closeButton} type="button" className={styles.close} aria-label="再現状況を閉じる" onClick={() => {
            setPosition(null)
            trigger.current?.focus()
          }}>✕</button>
        </div>
        <ul className={styles.list} tabIndex={0} aria-label="再現状況の一覧">
          {items.map((item, index) => <li key={index}>{item.message}</li>)}
        </ul>
      </div>, document.body,
    )}
  </>
}

/** Document diagnostics belong to the toolbar, outside image panels. */
export function ClipDiagnosticsControl() {
  const clip = useAppStore(s => s.clipDocument)
  const timelineId = useAppStore(s => s.clipTimelineId)
  const diagnostics = useAppStore(s => s.clipDiagnostics)
  return clip && diagnostics.length > 0 ? <Diagnostics key={timelineId} items={diagnostics} /> : null
}

export function ClipTimelineSelect() {
  const clip = useAppStore(s => s.clipDocument)
  const timelineId = useAppStore(s => s.clipTimelineId)
  const selectTimeline = useAppStore(s => s.selectClipTimeline)
  if (!clip || clip.timelines.length <= 1) return null

  return <div className={styles.controls}>
    {clip.timelines.length > 1 && <Tooltip content="タイムライン"><select data-tooltip="タイムライン"
      className={styles.timeline}
      aria-label="タイムライン"
      value={timelineId ?? ''}
      onChange={event => selectTimeline(Number(event.target.value))}
    >
      {clip.timelines.map(t => <option key={t.id} value={t.id}>{t.data.timeTableName || `タイムライン ${t.id}`}</option>)}
    </select></Tooltip>}
  </div>
}
