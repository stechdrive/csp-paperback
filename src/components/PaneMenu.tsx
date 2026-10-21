import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDismissableLayer } from '../hooks/useDismissableLayer'
import { PaneIcon } from './PaneIcon'
import { Tooltip } from './Tooltip'
import styles from './LayerTreePanel.module.css'

export function PaneMenu({ label, children }: { label: string; children: ReactNode }) {
  const trigger = useRef<HTMLButtonElement>(null), content = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  useDismissableLayer({ open: !!position, content, trigger, closeOnTab: true, closeOnScroll: true, closeOnResize: true,
    initialFocus: () => content.current?.querySelector('button:not(:disabled)'),
    onDismiss: reason => { setPosition(null); if (reason === 'escape' || reason === 'tab') trigger.current?.focus() } })
  return <><Tooltip content={label}><button ref={trigger} type="button" className={styles.paneIcon} aria-label={label} aria-haspopup="menu" aria-expanded={!!position}
    onClick={() => { const rect = trigger.current!.getBoundingClientRect(); setPosition(position ? null : { left: Math.max(4, Math.min(rect.right - 224, window.innerWidth - 228)), top: rect.bottom + 4 }) }}><PaneIcon kind="menu" /></button></Tooltip>
    {position && createPortal(<div ref={content} role="menu" aria-label={label} className={styles.outputMenu} style={position}
      onClick={event => { if ((event.target as HTMLElement).closest('button')) { setPosition(null); trigger.current?.focus() } }}
      onKeyDown={event => {
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
        buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (i + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length]?.focus()
      }}>{children}</div>, document.body)}
  </>
}
