import { useRef } from 'react'
import { usePreview } from '../hooks/usePreview'
import styles from './PreviewPanel.module.css'

export function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  usePreview(canvasRef)

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
    />
  )
}
