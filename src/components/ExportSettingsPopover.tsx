import { useDismissableLayer } from '../hooks/useDismissableLayer'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../store'
import { ExportSettings } from './ExportSettings'
import { SettingsDialog } from './SettingsDialog'
import styles from './ExportSettingsPopover.module.css'
import popupStyles from './Popover.module.css'

function positionFor(button: HTMLButtonElement) {
  const rect = button.getBoundingClientRect()
  const width = Math.min(700, window.innerWidth - 16)
  const top = rect.bottom + 6
  return { width, top, left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)), maxHeight: Math.max(0, window.innerHeight - top - 8) }
}

export function ExportSettingsPopover({ buttonClassName }: { buttonClassName?: string }) {
  const configTarget = useAppStore(s => s.docWidth === 0 ? 'saved' : 'current')
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState<ReturnType<typeof positionFor> | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const open = position !== null
  useDismissableLayer({ open, content: popup, trigger,
    initialFocus: () => close.current,
    onDismiss: reason => { setPosition(null); if (reason === 'escape') trigger.current?.focus({ preventScroll: true }) } })
  useEffect(() => {
    if (!open) return
    const reposition = () => { if (trigger.current) setPosition(positionFor(trigger.current)) }
    const observer = new ResizeObserver(reposition)
    if (trigger.current) observer.observe(trigger.current)
    window.addEventListener('resize', reposition)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', reposition)
    }
  }, [open])
  return <>
    <button ref={trigger} type="button" className={buttonClassName} aria-label="書き出し設定" aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? id : undefined}
      onClick={() => setPosition(open || !trigger.current ? null : positionFor(trigger.current))}>
      書き出し設定 <span aria-hidden="true">▾</span>
    </button>
    {position && createPortal(<div ref={popup} id={id} role="dialog" aria-label="書き出し設定" className={popupStyles.popup} style={position} data-testid="export-settings-popover">
      <div className={popupStyles.header}>
        <strong>書き出し設定</strong>
        <button ref={close} type="button" className={popupStyles.close} aria-label="書き出し設定を閉じる" onClick={() => { setPosition(null); trigger.current?.focus() }}>✕</button>
      </div>
      <div className={styles.content}><ExportSettings configTarget={configTarget} /></div>
      <div className={styles.actions}>
        <button type="button" className={styles.details} onClick={() => {
          setPosition(null)
          // The popover link is about to unmount. Return modal focus to the
          // persistent toolbar button, including Escape and backdrop dismissal.
          trigger.current?.focus({ preventScroll: true })
          setShowDetails(true)
        }}>詳細設定…</button>
      </div>
    </div>, document.body)}
    {showDetails && <SettingsDialog onClose={() => setShowDetails(false)} />}
  </>
}
