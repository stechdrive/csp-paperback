import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useAppStore } from '../store'
import { useZoomPan } from '../hooks/useZoomPan'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import {
  collectShiftNavigationExpandableFolders,
  flattenVisible,
  findLayerById,
  mergeExpandedFolders,
  subtractCollapsedFolders,
} from '../utils/layerNavigation'
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
  const tree = useAppStore(selectLayerTreeWithVisibility)
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const expandedFolders = useAppStore(s => s.expandedFolders)
  const userCollapsedFolders = useAppStore(s => s.userCollapsedFolders)
  const manualAnimFolderIds = useAppStore(s => s.manualAnimFolderIds)
  const virtualSets = useAppStore(s => s.virtualSets)
  const singleMarks = useAppStore(s => s.singleMarks)
  const selectLayer = useAppStore(s => s.selectLayer)
  const selectAnimCell = useAppStore(s => s.selectAnimCell)
  const setFocusedAnimFolder = useAppStore(s => s.setFocusedAnimFolder)
  const setSelectedVirtualSet = useAppStore(s => s.setSelectedVirtualSet)

  const shiftExpandableFolders = useMemo(
    () => collectShiftNavigationExpandableFolders(tree, manualAnimFolderIds, virtualSets),
    [tree, manualAnimFolderIds, virtualSets],
  )
  const navigationExpandedFolders = useMemo(
    () => subtractCollapsedFolders(
      mergeExpandedFolders(expandedFolders, shiftExpandableFolders),
      userCollapsedFolders,
    ),
    [expandedFolders, shiftExpandableFolders, userCollapsedFolders],
  )
  const entries = useMemo(() =>
    flattenVisible(tree, navigationExpandedFolders, manualAnimFolderIds, virtualSets),
    [tree, navigationExpandedFolders, manualAnimFolderIds, virtualSets],
  )

  const [active, setActive] = useState(false)
  const [showLabel, setShowLabel] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const currentIdx = useMemo(() => {
    if (selectedVirtualSetId) {
      return entries.findIndex(e => e.kind === 'virtualSet' && e.id === selectedVirtualSetId)
    }
    if (!selectedLayerId) return -1
    return entries.findIndex(e => e.kind === 'layer' && e.id === selectedLayerId)
  }, [entries, selectedLayerId, selectedVirtualSetId])

  const navigateTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= entries.length) return
    const entry = entries[idx]
    const alreadySelected = entry.kind === 'virtualSet'
      ? entry.id === selectedVirtualSetId
      : entry.id === selectedLayerId && selectedVirtualSetId === null
    if (alreadySelected) return

    if (entry.kind === 'virtualSet' && entry.virtualSet) {
      setSelectedVirtualSet(entry.virtualSet.id)
    } else if (entry.isCell && entry.animParentId) {
      const { layerTree } = useAppStore.getState()
      const animFolder = findLayerById(layerTree, entry.animParentId)
      if (animFolder) {
        const cellIdx = animFolder.children.findIndex(c => c.id === entry.id)
        if (cellIdx >= 0) {
          selectAnimCell(entry.animParentId, cellIdx)
          setFocusedAnimFolder(entry.animParentId)
        }
      }
      selectLayer(entry.id)
    } else if (entry.layer.isAnimationFolder) {
      selectLayer(entry.id)
      setFocusedAnimFolder(entry.id)
    } else if (entry.layer.autoMarked || singleMarks.has(entry.id)) {
      selectLayer(entry.id)
      setFocusedAnimFolder(null)
    } else {
      setSelectedVirtualSet(null)
      selectLayer(entry.id)
    }
  }, [
    entries,
    selectedLayerId,
    selectedVirtualSetId,
    singleMarks,
    selectLayer,
    selectAnimCell,
    setFocusedAnimFolder,
    setSelectedVirtualSet,
  ])

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
          {currentEntry.kind === 'virtualSet' && currentEntry.virtualSet
            ? currentEntry.virtualSet.name
            : currentEntry.layer.name}
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
