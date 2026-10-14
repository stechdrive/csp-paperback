import { memo, useEffect, useRef } from 'react'
import type { OutputPreviewEntry } from '../hooks/useOutputPreview'
import styles from './OutputPreview.module.css'

export const OutputPreviewImage = memo(function OutputPreviewImage({ entry, transparent }: { entry: OutputPreviewEntry; transparent: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = entry.canvas.width
    canvas.height = entry.canvas.height
    canvas.getContext('2d')?.drawImage(entry.canvas, 0, 0)
    return () => { canvas.width = 1; canvas.height = 1 }
  }, [entry.canvas])
  return <div className={styles.thumbnail}>
    <div className={transparent ? styles.thumbCheckerboard : styles.thumbDark}>
      <canvas ref={canvasRef} className={styles.thumbCanvas} aria-label={entry.flatName} />
    </div>
  </div>
})
