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

  useEffect(() => {
    if (!open) return
    closeButton.current?.focus()
    const outside = (event: Event) => {
      if (event.target instanceof Node && !popup.current?.contains(event.target) && !trigger.current?.contains(event.target)) {
        setPosition(null)
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setPosition(null)
      trigger.current?.focus()
    }
    const reposition = () => {
      if (trigger.current) setPosition(popupPosition(trigger.current))
    }
    const observer = new ResizeObserver(reposition)
    if (trigger.current?.parentElement) observer.observe(trigger.current.parentElement)
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

  return <>
    <button
      ref={trigger}
      type="button"
      className={styles.trigger}
      aria-expanded={open}
      aria-controls={open ? id : undefined}
      aria-haspopup="dialog"
      onClick={() => setPosition(open || !trigger.current ? null : popupPosition(trigger.current))}
    >
      再現状況 {items.length}件 <span aria-hidden="true">{open ? '▴' : '▾'}</span>
    </button>
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

/** Compact controls in the preview heading; diagnostics never participate in pane layout. */
export function ClipPreviewControls() {
  const clip = useAppStore(s => s.clipDocument)
  const timelineId = useAppStore(s => s.clipTimelineId)
  const selectTimeline = useAppStore(s => s.selectClipTimeline)
  const diagnostics = useAppStore(s => s.clipDiagnostics)
  if (!clip || (clip.timelines.length <= 1 && diagnostics.length === 0)) return null

  return <div className={styles.controls}>
    {clip.timelines.length > 1 && <select
      className={styles.timeline}
      aria-label="タイムライン"
      title="タイムライン"
      value={timelineId ?? ''}
      onChange={event => selectTimeline(Number(event.target.value))}
    >
      {clip.timelines.map(t => <option key={t.id} value={t.id}>{t.data.timeTableName || `タイムライン ${t.id}`}</option>)}
    </select>}
    {diagnostics.length > 0 && <Diagnostics key={timelineId} items={diagnostics} />}
  </div>
}
