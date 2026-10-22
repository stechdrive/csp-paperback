import { cloneElement, isValidElement, useId, useRef, useState, type MouseEventHandler, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDismissableLayer } from '../hooks/useDismissableLayer'
import { LayerIcon } from './LayerIcon'
import styles from './LayerTree.module.css'

function MenuAction({ children, onChoose }: { children: ReactNode; onChoose: () => void }) {
  return isValidElement<{ onClick: MouseEventHandler<HTMLButtonElement> }>(children)
    ? cloneElement(children, { onClick: event => { children.props.onClick(event); onChoose() } }) : children
}

export function LayerActionsMenu({ name, active, animation, individual, rename }: {
  name: string; active?: boolean; animation?: ReactNode; individual?: ReactNode; rename?: () => void
}) {
  const trigger = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null)
  const id = useId()
  const [position, setPosition] = useState<{ left: number; top: number; anchorX: number; anchorY: number; host: Element } | null>(null)
  const close = () => { setPosition(null); trigger.current?.focus({ preventScroll: true }) }
  useDismissableLayer({ open: !!position, trigger, content: popup, closeOnResize: true, closeOnScroll: true,
    initialFocus: () => popup.current?.querySelector('button'),
    onDismiss: reason => {
      // The scroll that brought the trigger into view can arrive after opening.
      // Dismiss only when a later scroll actually moves the anchor.
      if (reason === 'scroll' && position && trigger.current) {
        const rect = trigger.current.getBoundingClientRect()
        if (Math.abs(rect.x - position.anchorX) < 0.5 && Math.abs(rect.y - position.anchorY) < 0.5) return
      }
      setPosition(null)
      if (reason === 'escape') trigger.current?.focus({ preventScroll: true })
    },
  })
  if (!animation && !individual && !rename) return null
  return <>
    <button ref={trigger} type="button" className={`${styles.actionsButton} ${active ? styles.actionsActive : ''}`}
      aria-label={`${name}の補助操作`} aria-expanded={!!position} aria-haspopup="dialog" aria-controls={position ? id : undefined}
      onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
      onClick={event => {
        event.stopPropagation()
        if (position) { close(); return }
        const rect = event.currentTarget.getBoundingClientRect()
        setPosition({ left: Math.max(8, Math.min(rect.right - 270, window.innerWidth - 278)),
          top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 150)),
          anchorX: rect.x, anchorY: rect.y,
          host: event.currentTarget.closest('dialog[open]') ?? document.body })
      }}><LayerIcon kind={active ? 'star' : 'more'} /></button>
    {position && createPortal(<div ref={popup} id={id} className={styles.actionsPopup} style={{ left: position.left, top: position.top }}
      role="dialog" aria-label={`${name}の補助操作`} onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}>
      {rename && <button type="button" onClick={() => { close(); rename() }}>出力名を編集</button>}
      <MenuAction onChoose={close}>{animation}</MenuAction><MenuAction onChoose={close}>{individual}</MenuAction>
    </div>, position.host)}
  </>
}
