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
 * コンテンツがビューポートに収まる軸ではセンタリングを強制する。
 */
export function useZoomPan() {
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [view, setView] = useState<ViewState>({ zoom: 1, panX: 0, panY: 0 })
  const [dragging, setDragging] = useState(false)
  const viewRef = useRef(view)
  viewRef.current = view

  /** コンテンツがちょうどビューポートに収まるズーム率（動的下限） */
  const getFitZoom = (container: HTMLElement): number => {
    const content = container.firstElementChild as HTMLElement | null
    if (!content) return ZOOM_MIN
    const contentW = content.offsetWidth || 1
    const contentH = content.offsetHeight || 1
    const fit = Math.min(container.clientWidth / contentW, container.clientHeight / contentH)
    return Math.max(Math.min(fit, 1), ZOOM_MIN)
  }

  /**
   * コンテンツがビューポートに収まる軸の pan をセンタリング値に強制。
   * flexbox が unscaled レイアウトをセンタリングしているため、
   * scaled コンテンツのセンタリングには panX = (cw - scaledW)/2 - ox が必要。
   */
  const clampPan = (panX: number, panY: number, zoom: number, container: HTMLElement): { panX: number; panY: number } => {
    const content = container.firstElementChild as HTMLElement | null
    if (!content) return { panX, panY }
    const cw = container.clientWidth
    const ch = container.clientHeight
    const ox = content.offsetLeft
    const oy = content.offsetTop
    const scaledW = content.offsetWidth * zoom
    const scaledH = content.offsetHeight * zoom
    return {
      panX: scaledW <= cw ? (cw - scaledW) / 2 - ox : panX,
      panY: scaledH <= ch ? (ch - scaledH) / 2 - oy : panY,
    }
  }

  // ホイールズーム（passive: false でスクロールを抑制）
  useEffect(() => {
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      // コンテンツ要素のレイアウトオフセット（flexboxセンタリング分）を差し引く
      const content = el.firstElementChild as HTMLElement | null
      const ox = content?.offsetLeft ?? 0
      const oy = content?.offsetTop ?? 0
      const lx = mx - ox
      const ly = my - oy
      const zoomMin = getFitZoom(el)
      setView(prev => {
        const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
        const newZoom = Math.max(zoomMin, Math.min(ZOOM_MAX, prev.zoom * factor))
        const rawPanX = lx + (prev.panX - lx) * newZoom / prev.zoom
        const rawPanY = ly + (prev.panY - ly) * newZoom / prev.zoom
        const clamped = clampPan(rawPanX, rawPanY, newZoom, el)
        return { zoom: newZoom, ...clamped }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [el])

  // ドラッグパン
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || !el) return
    e.preventDefault()
    setDragging(true)
    const startX = e.clientX
    const startY = e.clientY
    const { panX: startPanX, panY: startPanY } = viewRef.current
    const container = el

    const onMove = (ev: MouseEvent) => {
      setView(prev => {
        const rawPanX = startPanX + ev.clientX - startX
        const rawPanY = startPanY + ev.clientY - startY
        const clamped = clampPan(rawPanX, rawPanY, prev.zoom, container)
        return { ...prev, ...clamped }
      })
    }
    const onUp = () => {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [el])

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
