import { useRef } from 'react'
import { usePreview } from '../hooks/usePreview'
import { useZoomPan } from '../hooks/useZoomPan'
import styles from './PreviewPanel.module.css'

export function NavigatorCanvas({ enabled = true }: { enabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { containerRef, contentStyle, containerStyle, onMouseDown, zoom } = useZoomPan()
  const error = usePreview(canvasRef, enabled)
  return <div className={styles.navigatorImage}>
    <div ref={containerRef} className={styles.navigatorViewport} style={containerStyle} onMouseDown={onMouseDown}>
      <canvas ref={canvasRef} className={styles.navigatorCanvas} style={contentStyle} aria-label="全体プレビューの画像" />
    </div>
    {zoom !== 1 && <span className={styles.zoomBadge}>{Math.round(zoom * 100)}%</span>}
    {error && <p role="alert">{error}</p>}
  </div>
}
