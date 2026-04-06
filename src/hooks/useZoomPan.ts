import { useState, useEffect, useRef, useCallback } from 'react'
import type React from 'react'

const ZOOM_MIN = 0.1
const ZOOM_MAX = 8
const ZOOM_STEP = 1.15

interface ViewState {
  zoom: number
  panX: number
  panY: number
}

/**
 * ズーム（マウスホイール）とパン（ドラッグ）を管理するフック。
 * containerRef を zoom/pan 対象の外側コンテナに、contentStyle を内側コンテンツに適用する。
 * ズームはカーソル位置を基準点として行う。
 */
export function useZoomPan() {
  // useState の setter を ref として使うことで、要素のマウント/アンマウントを正確に検知する
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [view, setView] = useState<ViewState>({ zoom: 1, panX: 0, panY: 0 })
  const [dragging, setDragging] = useState(false)
  const viewRef = useRef(view)
  viewRef.current = view

  // ホイールズーム（passive: false でスクロールを抑制）
  useEffect(() => {
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setView(prev => {
        const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
        const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev.zoom * factor))
        return {
          zoom: newZoom,
          // カーソル位置を固定したままズーム
          panX: mx + (prev.panX - mx) * newZoom / prev.zoom,
          panY: my + (prev.panY - my) * newZoom / prev.zoom,
        }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [el])

  // ドラッグパン
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    setDragging(true)
    const startX = e.clientX
    const startY = e.clientY
    const { panX: startPanX, panY: startPanY } = viewRef.current

    const onMove = (ev: MouseEvent) => {
      setView(prev => ({
        ...prev,
        panX: startPanX + ev.clientX - startX,
        panY: startPanY + ev.clientY - startY,
      }))
    }
    const onUp = () => {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const contentStyle: React.CSSProperties = {
    transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
    transformOrigin: '0 0',
    willChange: 'transform',
    imageRendering: view.zoom >= 2 ? 'pixelated' : 'auto',
  }

  const containerStyle: React.CSSProperties = {
    cursor: dragging ? 'grabbing' : 'grab',
    userSelect: 'none',
  }

  return {
    containerRef: setEl as (el: HTMLElement | null) => void,
    contentStyle,
    containerStyle,
    onMouseDown,
    zoom: view.zoom,
  }
}
