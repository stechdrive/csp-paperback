import React, { useRef, useEffect } from 'react'
import { useAppStore } from '../store'
import { useZoomPan } from '../hooks/useZoomPan'
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
  )
}
