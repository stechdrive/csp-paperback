import { useRef } from 'react'
import { usePreview } from '../hooks/usePreview'
import styles from './PreviewPanel.module.css'

export function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const error = usePreview(canvasRef)

  return (
    <>{error && <p role="alert">{error}</p>}<canvas
      ref={canvasRef}
      className={styles.canvas}
    /></>
  )
}
