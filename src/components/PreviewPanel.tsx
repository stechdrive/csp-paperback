import { useRef } from 'react'
import { useAppStore } from '../store'
import { usePreview } from '../hooks/usePreview'
import { useOutputPreview } from '../hooks/useOutputPreview'
import { OutputPreview } from './OutputPreview'
import { ExportSettings } from './ExportSettings'
import styles from './PreviewPanel.module.css'

function NavigatorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  usePreview(canvasRef)
  return (
    <div className={styles.navigatorSection}>
      <div className={styles.navigatorLabel}>全体（ナビゲーター）</div>
      <canvas ref={canvasRef} className={styles.navigatorCanvas} />
    </div>
  )
}

export function PreviewPanel() {
  const docWidth = useAppStore(s => s.docWidth)
  const focusedAnimFolderId = useAppStore(s => s.focusedAnimFolderId)
  const structure = useAppStore(s => s.outputConfig.structure)
  const entries = useOutputPreview()

  if (docWidth === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>プレビュー</div>
        <div className={styles.emptyWrapper}>
          <div className={styles.empty}>
            PSD ファイルをドロップするか<br />「PSD を開く」ボタンで読み込んでください
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>プレビュー</div>
      <NavigatorCanvas />
      <ExportSettings />
      <div className={styles.divider}>
        <span className={styles.dividerLabel}>出力プレビュー</span>
        {entries.length > 0 && (
          <div className={styles.fileNames}>
            {entries.map((e, i) => (
              <span key={i} className={styles.fileName} title={structure === 'hierarchy' ? e.path : e.flatName}>
                {structure === 'hierarchy' ? e.path : e.flatName}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={styles.outputSection}>
        <OutputPreview entries={entries} focusedAnimFolderId={focusedAnimFolderId} />
      </div>
    </div>
  )
}
