import { useCallback, useEffect, useRef, useState } from 'react'
import { isDesktopRuntime } from '../platform/runtime'

export type DragPayload =
  | { type: 'layer'; layerId: string }
  | { type: 'cell'; layerId: string; cellIndex: number }
  | { type: 'virtualSet'; virtualSetId: string }
  | { type: 'virtualSetMember'; setId: string; layerIds: string[] }

const DRAG_DATA_KEY = 'application/csp-paperback'

// ドラッグ中のペイロードをモジュールスコープで保持（dragoverではgetDataできないため）
let _activeDragPayload: DragPayload | null = null
export function getActiveDragPayload(): DragPayload | null {
  return _activeDragPayload
}

export interface DragHandlers {
  draggable: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: (e: React.DragEvent) => void
  onPointerDown: (e: React.PointerEvent) => void
}

export interface DropHandlers {
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

interface PointerPosition {
  clientX: number
  clientY: number
}

interface InternalDropTarget {
  canDrop: (payload: DragPayload) => boolean
  onDragOver?: (payload: DragPayload, position: PointerPosition) => void
  onDragLeave?: () => void
  onDrop: (payload: DragPayload, position: PointerPosition) => void
}

const POINTER_DRAG_THRESHOLD = 4
const internalDropTargets = new Map<HTMLElement, InternalDropTarget>()
let activeInternalDropTarget: HTMLElement | null = null

export function isInternalPointerDragEnabled(): boolean {
  return isDesktopRuntime()
}

function findInternalDropTarget(
  x: number,
  y: number,
  payload: DragPayload,
): { element: HTMLElement; target: InternalDropTarget } | null {
  let element = document.elementFromPoint(x, y)
  while (element) {
    if (element instanceof HTMLElement) {
      const target = internalDropTargets.get(element)
      if (target?.canDrop(payload)) return { element, target }
    }
    element = element.parentElement
  }
  return null
}

function dispatchInternalDragOver(payload: DragPayload, position: PointerPosition): void {
  const found = findInternalDropTarget(position.clientX, position.clientY, payload)
  if (found?.element !== activeInternalDropTarget) {
    if (activeInternalDropTarget) {
      internalDropTargets.get(activeInternalDropTarget)?.onDragLeave?.()
    }
    activeInternalDropTarget = found?.element ?? null
  }
  found?.target.onDragOver?.(payload, position)
}

function suppressNextClick(): void {
  const handler = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    document.removeEventListener('click', handler, true)
  }
  document.addEventListener('click', handler, true)
  window.setTimeout(() => document.removeEventListener('click', handler, true), 0)
}

export function startInternalPointerDrag(payload: DragPayload, e: React.PointerEvent): void {
  if (!isInternalPointerDragEnabled()) return
  if (e.button !== 0) return

  const pointerId = e.pointerId
  const startX = e.clientX
  const startY = e.clientY
  let dragging = false

  const cleanup = () => {
    document.removeEventListener('pointermove', handlePointerMove, true)
    document.removeEventListener('pointerup', handlePointerUp, true)
    document.removeEventListener('pointercancel', handlePointerCancel, true)
    if (activeInternalDropTarget) {
      internalDropTargets.get(activeInternalDropTarget)?.onDragLeave?.()
      activeInternalDropTarget = null
    }
    _activeDragPayload = null
  }

  const beginDragIfNeeded = (event: PointerEvent) => {
    if (dragging) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    if (Math.hypot(dx, dy) < POINTER_DRAG_THRESHOLD) return
    dragging = true
    _activeDragPayload = payload
    document.body.classList.add('is-internal-dragging')
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    beginDragIfNeeded(event)
    if (!dragging) return
    event.preventDefault()
    dispatchInternalDragOver(payload, { clientX: event.clientX, clientY: event.clientY })
  }

  const handlePointerUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    try {
      if (dragging) {
        event.preventDefault()
        const found = findInternalDropTarget(event.clientX, event.clientY, payload)
        found?.target.onDrop(payload, { clientX: event.clientX, clientY: event.clientY })
        suppressNextClick()
      }
    } finally {
      document.body.classList.remove('is-internal-dragging')
      cleanup()
    }
  }

  const handlePointerCancel = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    document.body.classList.remove('is-internal-dragging')
    cleanup()
  }

  document.addEventListener('pointermove', handlePointerMove, true)
  document.addEventListener('pointerup', handlePointerUp, true)
  document.addEventListener('pointercancel', handlePointerCancel, true)
}

export function useInternalDropTarget(target: InternalDropTarget): {
  dropRef: (node: HTMLElement | null) => void
  isOver: boolean
} {
  const targetRef = useRef(target)
  const elementRef = useRef<HTMLElement | null>(null)
  const [isOver, setIsOver] = useState(false)

  useEffect(() => {
    targetRef.current = {
      ...target,
      onDragOver: (payload, position) => {
        setIsOver(true)
        target.onDragOver?.(payload, position)
      },
      onDragLeave: () => {
        setIsOver(false)
        target.onDragLeave?.()
      },
      onDrop: (payload, position) => {
        setIsOver(false)
        target.onDrop(payload, position)
      },
    }
  }, [target])

  const dropRef = useCallback((node: HTMLElement | null) => {
    if (elementRef.current) internalDropTargets.delete(elementRef.current)
    elementRef.current = node
    if (node) {
      internalDropTargets.set(node, {
        canDrop: payload => targetRef.current.canDrop(payload),
        onDragOver: (payload, position) => targetRef.current.onDragOver?.(payload, position),
        onDragLeave: () => targetRef.current.onDragLeave?.(),
        onDrop: (payload, position) => targetRef.current.onDrop(payload, position),
      })
    }
  }, [])

  useEffect(() => {
    return () => {
      if (elementRef.current) internalDropTargets.delete(elementRef.current)
    }
  }, [])

  return { dropRef, isOver }
}

/**
 * ドラッグ元として使うフック
 */
export function useDragSource(payload: DragPayload): DragHandlers & { isDragging: boolean } {
  const [isDragging, setIsDragging] = useState(false)
  const nativeDraggable = !isInternalPointerDragEnabled()

  const onDragStart = useCallback((e: React.DragEvent) => {
    if (!nativeDraggable) {
      e.preventDefault()
      return
    }
    _activeDragPayload = payload
    e.dataTransfer.setData(DRAG_DATA_KEY, JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'copy'
    setIsDragging(true)
  }, [nativeDraggable, payload])

  const onDragEnd = useCallback(() => {
    _activeDragPayload = null
    setIsDragging(false)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startInternalPointerDrag(payload, e)
  }, [payload])

  return { draggable: nativeDraggable, onDragStart, onDragEnd, onPointerDown, isDragging }
}

export interface DropZoneResult {
  dropHandlers: DropHandlers
  dropRef: (node: HTMLElement | null) => void
  isOver: boolean
}

/**
 * ドロップゾーン側のフック（仮想セットのメンバー追加など、従来の drop-only ゾーン用）
 * onDrop コールバックに DragPayload を渡す
 */
export function useDropZone(onDrop: (payload: DragPayload) => void): DropZoneResult {
  const [isOver, setIsOver] = useState(false)
  const { dropRef, isOver: isPointerOver } = useInternalDropTarget({
    canDrop: payload => payload.type === 'layer',
    onDrop,
  })

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_DATA_KEY)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsOver(true)
    }
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(false)
    const raw = e.dataTransfer.getData(DRAG_DATA_KEY)
    if (!raw) return
    try {
      const payload = JSON.parse(raw) as DragPayload
      onDrop(payload)
    } catch {
      // ignore
    }
  }, [onDrop])

  return {
    dropHandlers: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
    dropRef,
    isOver: isOver || isPointerOver,
  }
}
