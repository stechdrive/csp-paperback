import React, { useRef, useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { selectOutputFiles, selectDraftOutputs } from '../store/selectors'
import { outputRenderQueue } from '../utils/output-render-queue'
import { useZoomPan } from '../hooks/useZoomPan'
import { useOutputNavigation } from '../hooks/useOutputNavigation'
import type { OutputPreviewEntry } from '../hooks/useOutputPreview'
import { OutputPreviewImage } from './OutputPreviewImage'
import { PreviewZoomControls } from './PreviewZoomControls'
import { isTouchCompatibilityClick, switchOutputViewByTouch } from '../utils/output-view'
import styles from './OutputPreview.module.css'

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

export function OutputPreview({ entries, zoomPan }: OutputPreviewProps) {
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null)
  const lastTap = useRef(0)
  const outputConfig = useAppStore(s => s.outputConfig)
  const activeId = useAppStore(s => s.activeOutputId)
  const activeLabel = useAppStore(s => s.activeOutputLabel)
  const files = useAppStore(selectOutputFiles), drafts = useAppStore(selectDraftOutputs)
  const file = [...files, ...drafts].find(file => file.outputId === activeId)
  const error = file ? outputRenderQueue.get(file, 1024)?.error : undefined
  const transparent = outputConfig.format === 'png' && outputConfig.background === 'transparent'
  const { containerRef, containerStyle } = zoomPan

  const isEmpty = !activeId && entries.length === 0
  const hasNoEntries = !isEmpty && entries.length === 0

  return (
    <div className={styles.outputWrapper}>
      <div
        ref={containerRef as React.RefCallback<HTMLDivElement>}
        className={styles.zoomPanOuter}
        style={entries.length > 0 ? containerStyle : undefined}
        onDoubleClick={() => { if (!isTouchCompatibilityClick()) useAppStore.getState().setOutputViewMode('tiles') }}
        tabIndex={0}
        aria-label="１点表示の画像"
        onKeyDown={event => { if (event.key === 'Enter' && event.target === event.currentTarget) useAppStore.getState().setOutputViewMode('tiles') }}
        onTouchStart={event => { touchStart.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY, time: performance.now() } : null }}
        onTouchMove={event => {
          const start = touchStart.current
          if (event.touches.length !== 1 || (start && Math.hypot(event.touches[0].clientX - start.x, event.touches[0].clientY - start.y) > 8)) touchStart.current = null
        }}
        onTouchEnd={() => {
          const now = performance.now()
          if (touchStart.current && now - touchStart.current.time < 250) {
            if (now - lastTap.current < 350) switchOutputViewByTouch('tiles')
            lastTap.current = now
          }
          touchStart.current = null
        }}
      >
        {isEmpty && (
          <div className={styles.empty}>
            表示する出力がありません
          </div>
        )}
        {hasNoEntries && (
          <div className={styles.empty}>
            {activeLabel && <><strong>{activeLabel}</strong><br /></>}
            {error ?? (file ? '合成中…' : '現在の表示・書き出し設定では出力されません。レイヤーの表示状態・工程チェック、または素材の削除を確認してください。')}
          </div>
        )}
        {entries.length > 0 && file && <OutputPreviewImage entry={entries[0]} file={file} transparent={transparent}
          camera={zoomPan.camera} pixelRatio={zoomPan.pixelRatio} />}
      </div>
      {entries.length > 0 && <PreviewZoomControls {...zoomPan} />}
      <LayerSeekBar />
    </div>
  )
}
