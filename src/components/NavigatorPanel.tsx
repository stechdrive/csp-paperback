import { useRef, useState, type PointerEvent } from 'react'
import { useAppStore } from '../store'
import { usePreview } from '../hooks/usePreview'
import { useZoomPan } from '../hooks/useZoomPan'
import { ClipPreviewControls } from './ClipPreviewControls'
import { TimelineSeekBar } from './TimelineSeekBar'
import styles from './PreviewPanel.module.css'

export function NavigatorCanvas({ enabled = true }: { enabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { containerRef, contentStyle, containerStyle, onMouseDown, zoom } = useZoomPan()
  usePreview(canvasRef, enabled)
  return <div className={styles.navigatorImage}>
    <div ref={containerRef} className={styles.navigatorViewport} style={containerStyle} onMouseDown={onMouseDown}>
      <canvas ref={canvasRef} className={styles.navigatorCanvas} style={contentStyle} aria-label="全体ナビゲーターの画像" />
    </div>
    {zoom !== 1 && <span className={styles.zoomBadge}>{Math.round(zoom * 100)}%</span>}
  </div>
}

/** The timeline stays with the navigator, so changing the main view never moves the tree. */
export function NavigatorPanel({ enabled, onEnlarge }: { enabled: boolean; onEnlarge: () => void }) {
  const docWidth = useAppStore(s => s.docWidth)
  const [height, setHeight] = useState(238)
  const resize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const startY = event.clientY
    const startHeight = height
    const onMove = (move: globalThis.PointerEvent) => setHeight(Math.min(500, Math.max(150, startHeight + move.clientY - startY)))
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }
  if (!docWidth) return null
  return <>
    <section className={styles.navigatorSection} style={{ height }} aria-label="ナビゲーターパネル" data-testid="navigator-panel">
      <div className={styles.navigatorLabel}>
        <span>全体ナビゲーター</span>
        <button className={styles.iconButton} onClick={onEnlarge} title="中央で大きく表示" aria-label="全体ナビゲーターを中央で大きく表示">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6" /></svg>
        </button>
      </div>
      <ClipPreviewControls />
      <NavigatorCanvas enabled={enabled} />
      <TimelineSeekBar />
    </section>
    <div className={styles.resizeHandle} onPointerDown={resize} title="ナビゲーターの高さを変更" />
  </>
}
