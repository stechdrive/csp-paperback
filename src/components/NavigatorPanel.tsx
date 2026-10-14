import { Tooltip } from './Tooltip'
import { useRef, useState, type PointerEvent } from 'react'
import { useAppStore } from '../store'
import { usePreview } from '../hooks/usePreview'
import { useZoomPan } from '../hooks/useZoomPan'
import { ClipTimelineSelect } from './ClipPreviewControls'
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
export function NavigatorPanel({ enabled }: { enabled: boolean }) {
  const docWidth = useAppStore(s => s.docWidth)
  const [height, setHeight] = useState(200)
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
      <ClipTimelineSelect />
      <NavigatorCanvas enabled={enabled} />
      <TimelineSeekBar />
    </section>
    <Tooltip content="ナビゲーターの高さを変更"><div data-tooltip="ナビゲーターの高さを変更" className={styles.resizeHandle} onPointerDown={resize} /></Tooltip>
  </>
}
