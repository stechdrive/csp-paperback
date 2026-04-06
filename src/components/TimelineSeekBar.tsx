import { useRef, useCallback } from 'react'
import { useAppStore } from '../store'
import styles from './PreviewPanel.module.css'

export function TimelineSeekBar() {
  const currentFrame = useAppStore(s => s.currentFrame)
  const duration = useAppStore(s => s.xdtsData?.duration ?? 0)
  const fps = useAppStore(s => s.xdtsData?.fps ?? 24)
  const seekToFrame = useAppStore(s => s.seekToFrame)
  const trackRef = useRef<HTMLDivElement>(null)

  const calcFrame = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track || duration <= 1) return 0
    const rect = track.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * (duration - 1))
  }, [duration])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const frame = calcFrame(e.clientX)
    seekToFrame(frame)

    let lastFrame = frame
    const onMove = (ev: PointerEvent) => {
      const f = calcFrame(ev.clientX)
      if (f !== lastFrame) {
        lastFrame = f
        seekToFrame(f)
      }
    }
    const onUp = () => {
      target.releasePointerCapture(e.pointerId)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }, [calcFrame, seekToFrame])

  if (duration <= 0) return null

  const percent = duration <= 1 ? 0 : (currentFrame / (duration - 1)) * 100
  const secs = Math.floor(currentFrame / fps)
  const subFrame = (currentFrame % fps) + 1  // 1-based

  return (
    <div className={styles.seekBar}>
      <div
        ref={trackRef}
        className={styles.seekTrack}
        onPointerDown={handlePointerDown}
      >
        <div className={styles.seekFill} style={{ width: `${percent}%` }} />
        <div className={styles.seekThumb} style={{ left: `${percent}%` }} />
      </div>
      <span className={styles.seekLabel}>{secs}秒{subFrame}コマ</span>
    </div>
  )
}
