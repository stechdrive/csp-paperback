import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDismissableLayer } from '../hooks/useDismissableLayer'
import { LayerActionsContext, type LayerMenu } from '../hooks/useLayerActions'
import { LayerIcon } from './LayerIcon'
import styles from './LayerTree.module.css'

/** One popup per tree, including the isolated interactive Help example. */
export function LayerActionsProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<LayerMenu | null>(null)
  const actionsContext = useMemo(() => ({ show: setMenu, close: (row: HTMLElement) => setMenu(current => current?.row === row ? null : current) }), [])
  const popup = useRef<HTMLDivElement>(null)
  const restore = () => menu?.row.closest<HTMLElement>('[data-layer-tree-focus]')?.focus({ preventScroll: true })
  useDismissableLayer({ open: !!menu, content: popup, trigger: { current: menu?.row ?? null }, closeOnTab: true,
    closeOnResize: true, closeOnScroll: true,
    initialFocus: () => popup.current?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? popup.current,
    onDismiss: reason => {
      if (reason === 'scroll' && menu?.row.isConnected && Math.abs(menu.row.getBoundingClientRect().top - menu.anchorY) < .5) return
      setMenu(null)
      if (reason === 'escape' || reason === 'tab') restore()
    } })
  useEffect(() => {
    if (!menu) return
    const observer = new MutationObserver(() => { if (!menu.row.isConnected) setMenu(null) })
    observer.observe(menu.row.ownerDocument.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [menu])
  useLayoutEffect(() => {
    if (!menu || !popup.current) return
    const rect = popup.current.getBoundingClientRect()
    popup.current.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - rect.width - 8))}px`
    popup.current.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - rect.height - 8))}px`
    ;(popup.current.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? popup.current).focus({ preventScroll: true })
  }, [menu])
  return <LayerActionsContext.Provider value={actionsContext}>{children}{menu && createPortal(
    <div ref={popup} role="menu" tabIndex={-1} aria-label={`${menu.name}の操作`} className={styles.actionsPopup}
      style={{ left: Math.max(8, Math.min(menu.x, window.innerWidth - 278)),
        top: Math.max(8, Math.min(menu.y, window.innerHeight - (menu.actions.length * 38 + 12))) }}
      onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
      onContextMenu={event => event.preventDefault()}
      onKeyDown={event => {
        event.stopPropagation()
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'ArrowDown' ? (current + 1) % buttons.length
          : event.key === 'ArrowUp' ? (current + buttons.length - 1) % buttons.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : null
        if (next !== null) { event.preventDefault(); buttons[next]?.focus() }
      }}>
      {menu.actions.map(action => <button key={action.id} type="button"
        role={action.checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={action.checked}
        disabled={action.disabled} onClick={() => { setMenu(null); restore(); action.run?.() }}>
        {(action.id === 'individual' || action.id === 'animation') && <LayerIcon kind={action.id === 'individual' ? 'star' : 'animation'} />}
        <span>{action.label}</span>{action.checked && <span aria-hidden="true">✓</span>}
      </button>)}
    </div>, menu.row.closest('dialog[open]') ?? document.body,
  )}</LayerActionsContext.Provider>
}
