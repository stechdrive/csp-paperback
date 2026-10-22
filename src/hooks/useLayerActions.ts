import { createContext, useContext, useEffect, useLayoutEffect, useRef, type RefObject, type MouseEvent, type KeyboardEvent, type PointerEvent, type DragEvent } from 'react'
import type { LayerAction } from '../utils/layer-row-state'
import { cancelPendingPointerDrag } from './useDragDrop'

export interface LayerMenu { name: string; actions: LayerAction[]; row: HTMLElement; x: number; y: number; anchorY: number }
export const LayerActionsContext = createContext<{ show: (menu: LayerMenu) => void; close: (row: HTMLElement) => void }>({ show: () => {}, close: () => {} })

export function useLayerActions(name: string, actions: LayerAction[] | undefined, row: RefObject<HTMLElement | null>, select?: () => void) {
  const { show, close } = useContext(LayerActionsContext)
  const actionState = JSON.stringify(actions?.map(({ id, label, checked, disabled }) => [id, label, checked, disabled]))
  useLayoutEffect(() => {
    const element = row.current
    // Undo or a changed role must not leave an obsolete toggle in an open menu.
    return () => { if (element) close(element) }
  }, [actionState, close, row])
  const pending = useRef<(() => void) | undefined>(undefined)
  const suppressClick = useRef(false)
  const cancel = () => { pending.current?.(); pending.current = undefined }
  useEffect(() => () => pending.current?.(), [])
  const open = (x: number, y: number) => {
    cancel()
    if (!row.current || !actions?.length) return
    cancelPendingPointerDrag()
    select?.()
    show({ name, actions, row: row.current, x, y, anchorY: row.current.getBoundingClientRect().top })
  }
  return {
    onContextMenu: (event: MouseEvent<HTMLElement>) => {
      if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]')) return
      if (!actions?.length) return
      event.preventDefault(); event.stopPropagation(); open(event.clientX, event.clientY)
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.nativeEvent.isComposing || event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]')) return
      if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
      event.preventDefault(); event.stopPropagation()
      const rect = row.current?.getBoundingClientRect()
      if (rect) open(rect.left + 20, rect.bottom)
    },
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      cancel(); suppressClick.current = false
      if (!actions?.length || event.pointerType !== 'touch' || event.target instanceof Element && event.target.closest('button, input, select, textarea, a, [contenteditable="true"]')) return
      const { clientX, clientY, pointerId } = event
      const move = (next: globalThis.PointerEvent) => {
        if (next.pointerId === pointerId && Math.hypot(next.clientX - clientX, next.clientY - clientY) >= 4) cancel()
      }
      const timer = setTimeout(() => { suppressClick.current = true; open(clientX, clientY) }, 550)
      document.addEventListener('pointermove', move, true)
      document.addEventListener('pointerup', cancel, true)
      document.addEventListener('pointercancel', cancel, true)
      window.addEventListener('scroll', cancel, true)
      window.addEventListener('blur', cancel)
      pending.current = () => {
        clearTimeout(timer)
        document.removeEventListener('pointermove', move, true)
        document.removeEventListener('pointerup', cancel, true)
        document.removeEventListener('pointercancel', cancel, true)
        window.removeEventListener('scroll', cancel, true)
        window.removeEventListener('blur', cancel)
      }
    },
    onDragStartCapture: (event: DragEvent<HTMLElement>) => { cancel(); if (suppressClick.current) event.preventDefault() },
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false }
    },
  }
}
