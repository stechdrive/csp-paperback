import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { useZoomPan } from '../hooks/useZoomPan'
import { useOutputNavigation } from '../hooks/useOutputNavigation'
import type { OutputPreviewEntry } from '../hooks/useOutputPreview'
import styles from './OutputPreview.module.css'

function Thumbnail({ entry, transparent }: { entry: OutputPreviewEntry; transparent: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    el.width = entry.canvas.width
    el.height = entry.canvas.height
    const ctx = el.getContext('2d')
    ctx?.drawImage(entry.canvas, 0, 0)
  }, [entry.canvas])

  return (
    <div className={styles.thumbnail}>
      <div className={transparent ? styles.thumbCheckerboard : styles.thumbDark}>
        <canvas ref={canvasRef} className={styles.thumbCanvas} />
      </div>
    </div>
  )
}

/** モバイル用縦シークバー — レイヤーツリーのShift+スクロールと同等の操作 */
function LayerSeekBar() {
  const { entries, currentIdx, navigateTo } = useOutputNavigation()

  const [active, setActive] = useState(false)
  const [showLabel, setShowLabel] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const idxFromY = useCallback((clientY: number) => {
    const track = trackRef.current
    if (!track || entries.length === 0) return -1
    const rect = track.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    return Math.round(ratio * (entries.length - 1))
  }, [entries])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
    setActive(true)
    setShowLabel(true)
    clearTimeout(fadeTimer.current)
    const idx = idxFromY(e.touches[0].clientY)
    if (idx >= 0) navigateTo(idx)
  }, [idxFromY, navigateTo])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const idx = idxFromY(e.touches[0].clientY)
    if (idx >= 0) navigateTo(idx)
  }, [idxFromY, navigateTo])

  const handleTouchEnd = useCallback(() => {
    setActive(false)
    fadeTimer.current = setTimeout(() => setShowLabel(false), 1500)
  }, [])

  // マウス操作（デバッグ用・PC対応）
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setActive(true)
    setShowLabel(true)
    clearTimeout(fadeTimer.current)
    const idx = idxFromY(e.clientY)
    if (idx >= 0) navigateTo(idx)

    const onMove = (ev: MouseEvent) => {
      const i = idxFromY(ev.clientY)
      if (i >= 0) navigateTo(i)
    }
    const onUp = () => {
      setActive(false)
      fadeTimer.current = setTimeout(() => setShowLabel(false), 1500)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [idxFromY, navigateTo])

  if (entries.length < 2) return null

  const thumbRatio = entries.length > 0 && currentIdx >= 0
    ? currentIdx / (entries.length - 1)
    : 0

  const currentEntry = currentIdx >= 0 ? entries[currentIdx] : null

  return (
    <div
      className={`${styles.seekBarVertical} ${active ? styles.seekBarActive : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      <div ref={trackRef} className={styles.seekTrackVertical}>
        <div
          className={styles.seekThumbVertical}
          style={{ top: `${thumbRatio * 100}%` }}
        />
      </div>
      {showLabel && currentEntry && (
        <div className={styles.seekLabelVertical}>
          {currentEntry.label}
        </div>
      )}
    </div>
  )
}

type ZoomPanReturn = ReturnType<typeof useZoomPan>

interface OutputPreviewProps {
  entries: OutputPreviewEntry[]
  focusedAnimFolderId: string | null
  zoomPan: ZoomPanReturn
}

export function OutputPreview({ entries, focusedAnimFolderId, zoomPan }: OutputPreviewProps) {
  const outputConfig = useAppStore(s => s.outputConfig)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const transparent = outputConfig.format === 'png' && outputConfig.background === 'transparent'
  const { containerRef, contentStyle, containerStyle, onMouseDown } = zoomPan

  const isEmpty = !focusedAnimFolderId && !selectedVirtualSetId && entries.length === 0
  const hasNoEntries = !isEmpty && entries.length === 0

  return (
    <div className={styles.outputWrapper}>
      <div
        ref={containerRef as React.RefCallback<HTMLDivElement>}
        className={styles.zoomPanOuter}
        style={entries.length > 0 ? containerStyle : undefined}
        onMouseDown={entries.length > 0 ? onMouseDown : undefined}
      >
        {isEmpty && (
          <div className={styles.empty}>
            レイヤーツリーのアニメフォルダでセルを選択するか<br />左ペインの仮想セットをクリックすると<br />出力プレビューを表示します
          </div>
        )}
        {hasNoEntries && (
          <div className={styles.empty}>
            出力するセルがありません
          </div>
        )}
        {entries.length > 0 && (
          <div style={contentStyle}>
            <div className={styles.list}>
              {entries.map((e, i) => (
                <Thumbnail key={`${e.flatName}-${i}`} entry={e} transparent={transparent} />
              ))}
            </div>
          </div>
        )}
      </div>
      <LayerSeekBar />
    </div>
  )
}
