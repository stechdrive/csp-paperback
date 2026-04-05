import { useRef, useEffect } from 'react'
import { useAppStore } from '../store'
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
        <canvas
          ref={canvasRef}
          className={styles.thumbCanvas}
        />
      </div>
    </div>
  )
}

interface OutputPreviewProps {
  entries: OutputPreviewEntry[]
  focusedAnimFolderId: string | null
}

export function OutputPreview({ entries, focusedAnimFolderId }: OutputPreviewProps) {
  const outputConfig = useAppStore(s => s.outputConfig)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const transparent = outputConfig.format === 'png' && outputConfig.background === 'transparent'
  if (!focusedAnimFolderId && !selectedVirtualSetId && entries.length === 0) {
    return (
      <div className={styles.empty}>
        レイヤーツリーのアニメフォルダでセルを選択するか<br />左ペインの仮想セットをクリックすると<br />出力プレビューを表示します
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className={styles.empty}>
        出力するセルがありません
      </div>
    )
  }

  return (
    <div className={styles.list}>
      {entries.map((e, i) => (
        <Thumbnail key={`${e.flatName}-${i}`} entry={e} transparent={transparent} />
      ))}
    </div>
  )
}
