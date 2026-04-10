import { useCallback, useState } from 'react'

export type DragPayload =
  | { type: 'layer'; layerId: string }
  | { type: 'cell'; layerId: string; cellIndex: number }
  | { type: 'virtualSet'; virtualSetId: string }

const DRAG_DATA_KEY = 'application/csp-paperback'

// ドラッグ中のペイロードをモジュールスコープで保持（dragoverではgetDataできないため）
let _activeDragPayload: DragPayload | null = null
export function getActiveDragPayload(): DragPayload | null {
  return _activeDragPayload
}

export interface DragHandlers {
  draggable: true
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: (e: React.DragEvent) => void
}

export interface DropHandlers {
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

/**
 * ドラッグ元として使うフック
 */
export function useDragSource(payload: DragPayload): DragHandlers & { isDragging: boolean } {
  const [isDragging, setIsDragging] = useState(false)

  const onDragStart = useCallback((e: React.DragEvent) => {
    _activeDragPayload = payload
    e.dataTransfer.setData(DRAG_DATA_KEY, JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'copy'
    setIsDragging(true)
  }, [payload])

  const onDragEnd = useCallback(() => {
    _activeDragPayload = null
    setIsDragging(false)
  }, [])

  return { draggable: true, onDragStart, onDragEnd, isDragging }
}

export interface DropZoneResult {
  dropHandlers: DropHandlers
  isOver: boolean
}

/**
 * ドロップゾーン側のフック（仮想セットのメンバー追加など、従来の drop-only ゾーン用）
 * onDrop コールバックに DragPayload を渡す
 */
export function useDropZone(onDrop: (payload: DragPayload) => void): DropZoneResult {
  const [isOver, setIsOver] = useState(false)

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
    isOver,
  }
}
