import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n'
import { VirtualSetItem } from './VirtualSetItem'
import { useVirtualSetPreview } from '../hooks/useVirtualSetPreview'
import styles from './VirtualSetPanel.module.css'

function VsPreview() {
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const outputConfig = useAppStore(s => s.outputConfig)
  const docWidth = useAppStore(s => s.docWidth)
  const canvas = useVirtualSetPreview(selectedVirtualSetId)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const transparent = outputConfig.format === 'png' && outputConfig.background === 'transparent'

  useEffect(() => {
    const el = canvasRef.current
    if (!el || !canvas) return
    el.width = canvas.width
    el.height = canvas.height
    const ctx = el.getContext('2d')
    ctx?.drawImage(canvas, 0, 0)
  }, [canvas])

  if (docWidth === 0) return null

  return (
    <div className={styles.previewSection}>
      <div className={styles.previewLabel}>プレビュー</div>
      {canvas ? (
        <div className={transparent ? styles.previewCheckerboard : styles.previewDark}>
          <canvas ref={canvasRef} className={styles.previewCanvas} />
        </div>
      ) : (
        <div className={styles.previewEmpty}>
          {selectedVirtualSetId ? 'メンバーを追加すると表示' : '仮想セルを選択すると表示'}
        </div>
      )}
    </div>
  )
}

export function VirtualSetPanel() {
  const virtualSets = useAppStore(s => s.virtualSets)
  const addVirtualSet = useAppStore(s => s.addVirtualSet)
  const { t } = useLocale()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? '展開' : '折りたたむ'}
        >
          {collapsed ? '▶' : '▼'}
        </button>
        <span className={styles.title}>{t.virtualSet.title}</span>
        <button
          className={styles.addBtn}
          onClick={() => addVirtualSet(t.virtualSet.newSetName)}
        >
          {t.virtualSet.add}
        </button>
      </div>
      <div className={`${styles.list} ${collapsed ? styles.listCollapsed : ''}`}>
        {virtualSets.length === 0 ? (
          <div className={styles.empty}>
            {t.virtualSet.empty.split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </div>
        ) : (
          virtualSets.map(vs => (
            <VirtualSetItem key={vs.id} virtualSet={vs} />
          ))
        )}
      </div>
      <VsPreview />
    </div>
  )
}
