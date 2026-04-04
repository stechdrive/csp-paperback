import { useAppStore } from '../store'
import { PreviewCanvas } from './PreviewCanvas'
import styles from './PreviewPanel.module.css'

export function PreviewPanel() {
  const docWidth = useAppStore(s => s.docWidth)

  return (
    <div className={styles.panel}>
      <div className={styles.header}>プレビュー</div>
      <div className={styles.canvasWrapper}>
        {docWidth > 0 ? (
          <PreviewCanvas />
        ) : (
          <div className={styles.empty}>
            PSD ファイルをドロップするか<br />「PSD を開く」ボタンで読み込んでください
          </div>
        )}
      </div>
    </div>
  )
}
