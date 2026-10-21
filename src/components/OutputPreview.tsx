import React, { useRef, useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { selectOutputFiles, selectDraftOutputs } from '../store/selectors'
import { outputRenderQueue } from '../utils/output-render-queue'
import { useZoomPan } from '../hooks/useZoomPan'
import { useOutputNavigation } from '../hooks/useOutputNavigation'
import type { OutputPreviewEntry } from '../hooks/useOutputPreview'
import { OutputPreviewImage } from './OutputPreviewImage'
import { TiledOutputPreview } from './TiledOutputPreview'
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
  const outputConfig = useAppStore(s => s.outputConfig)
  const tiled = useAppStore(s => s.compareOutputs)
  const activeId = useAppStore(s => s.activeOutputId)
  const activeLabel = useAppStore(s => s.activeOutputLabel)
  const files = useAppStore(selectOutputFiles), drafts = useAppStore(selectDraftOutputs)
  const file = [...files, ...drafts].find(file => file.outputId === activeId)
  const error = file ? outputRenderQueue.get(file, 'full')?.error : undefined
  const transparent = outputConfig.format === 'png' && outputConfig.background === 'transparent'
  const { containerRef, contentStyle, containerStyle, onMouseDown } = zoomPan

  const isEmpty = !activeId && entries.length === 0
  const hasNoEntries = !isEmpty && entries.length === 0

  if (tiled) return <TiledOutputPreview entries={entries} transparent={transparent} />

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
            出力一覧で画像を選択すると<br />ここに書き出し結果を表示します。<br />素材単体の確認はツリー選択後にSpace。
          </div>
        )}
        {hasNoEntries && (
          <div className={styles.empty}>
            {activeLabel && <><strong>{activeLabel}</strong><br /></>}
            {error ?? (file ? '合成中…' : '現在の表示・書き出し設定では出力されません。レイヤーの表示状態・工程チェック、または素材の削除を確認してください。')}
          </div>
        )}
        {entries.length > 0 && (
          <div style={contentStyle}>
            <div className={styles.list}>
              {entries.map((e, i) => (
                <OutputPreviewImage key={`${e.flatName}-${i}`} entry={e} transparent={transparent} />
              ))}
            </div>
          </div>
        )}
      </div>
      <LayerSeekBar />
    </div>
  )
}
