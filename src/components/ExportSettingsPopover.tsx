import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ExportSettings } from './ExportSettings'
import styles from './PreviewPanel.module.css'

function positionFor(button: HTMLButtonElement) {
  const rect = button.getBoundingClientRect()
  const width = Math.min(700, window.innerWidth - 16)
  const bottom = window.innerHeight - rect.top + 6
  return { width, bottom, left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)), maxHeight: Math.max(120, rect.top - 14) }
}

export function ExportSettingsPopover({ children }: { children?: ReactNode }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState<ReturnType<typeof positionFor> | null>(null)
  const open = position !== null
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
    return () => {
      observer.disconnect()
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', reposition)
    }
  }, [open])
  return <div className={styles.settingsFooter} data-testid="preview-footer">
    {children}
    <button ref={trigger} type="button" className={styles.settingsToggle} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? id : undefined}
      onClick={() => setPosition(open || !trigger.current ? null : positionFor(trigger.current))}>
      書き出し設定 <span aria-hidden="true">{open ? '▾' : '▴'}</span>
    </button>
    {position && createPortal(<div ref={popup} id={id} role="dialog" aria-label="書き出し設定" className={styles.settingsPopup} style={position} data-testid="export-settings-popover">
      <div className={styles.settingsHeader}>
        <strong>書き出し設定</strong>
        <button ref={close} className={styles.iconButton} aria-label="書き出し設定を閉じる" onClick={() => { setPosition(null); trigger.current?.focus() }}>✕</button>
      </div>
      <div className={styles.settingsContent}><ExportSettings /></div>
    </div>, document.body)}
  </div>
}
