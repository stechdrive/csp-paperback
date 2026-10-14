import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDismissableLayer } from '../hooks/useDismissableLayer'
import styles from './Modal.module.css'

/** Native modal focus/inert handling; styling and close-time cleanup stay with the caller. */
export function Modal({ children, className, label, labelledBy, onClose }: {
  children: ReactNode; className: string; label?: string; labelledBy?: string; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const startedOnBackdrop = useRef(false)
  useDismissableLayer({ open: true, content: dialog, closeOnBlur: false,
    onDismiss: reason => { if (reason === 'escape') onClose() } })
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const element = dialog.current!
    element.showModal()
    return () => { element.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  return createPortal(<dialog ref={dialog} className={`${styles.modal} ${className}`} aria-label={label} aria-labelledby={labelledBy}
    aria-modal="true" onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }}
    onKeyDown={event => {
      if (event.key !== 'Tab' || event.defaultPrevented || (event.target as Element).closest('dialog') !== event.currentTarget) return
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
        .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}
    onPointerDown={event => { startedOnBackdrop.current = event.target === event.currentTarget }}
    onClick={event => { if (event.target === event.currentTarget && startedOnBackdrop.current) onClose() }}>
    {children}
  </dialog>, document.body)
}
