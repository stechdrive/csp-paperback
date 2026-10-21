import { useRef } from 'react'
import { usePreview } from '../hooks/usePreview'
import { useZoomPan } from '../hooks/useZoomPan'
import { useAppStore } from '../store'
import { PreviewZoomControls } from './PreviewZoomControls'
import styles from './PreviewPanel.module.css'

export function NavigatorCanvas({ enabled = true }: { enabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const width = useAppStore(s => s.docWidth), height = useAppStore(s => s.docHeight)
  const document = useAppStore(s => s.clipDocument ?? s.rawPsd)
  const zoomPan = useZoomPan({ width, height }, document)
  const { containerRef, contentStyle, containerStyle } = zoomPan
  const error = usePreview(canvasRef, enabled)
  return <div className={styles.navigatorImage}>
    <div ref={containerRef} className={styles.navigatorViewport} style={containerStyle} tabIndex={0}>
      <canvas ref={canvasRef} className={styles.navigatorCanvas} style={contentStyle} aria-label="全体プレビューの画像" />
    </div>
    <PreviewZoomControls {...zoomPan} />
    {error && <p role="alert">{error}</p>}
  </div>
}
