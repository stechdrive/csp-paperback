import { useState, useCallback } from 'react'
import { VirtualSetPanel } from './VirtualSetPanel'
import { PreviewPanel } from './PreviewPanel'
import { LayerTreePanel } from './LayerTreePanel'
import styles from './MainLayout.module.css'

const LEFT_DEFAULT = 260
const LEFT_MIN = 200
const LEFT_MAX = 600

const RIGHT_DEFAULT = 300
const RIGHT_MIN = 200
const RIGHT_MAX = 700

type MobileTab = 'virtual' | 'preview' | 'layer'

export function MainLayout() {
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT)
  const [activeTab, setActiveTab] = useState<MobileTab>('preview')

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (leftCollapsed) return
    const startX = e.clientX
    const startWidth = leftWidth

    const onMouseMove = (ev: MouseEvent) => {
      const next = Math.max(LEFT_MIN, Math.min(LEFT_MAX, startWidth + (ev.clientX - startX)))
      setLeftWidth(next)
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }, [leftWidth, leftCollapsed])

  const handleRightResizeMouseDown = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX
    const startWidth = rightWidth

    const onMouseMove = (ev: MouseEvent) => {
      // 右ペインはドラッグ方向が逆（左へドラッグで広がる）
      const next = Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, startWidth - (ev.clientX - startX)))
      setRightWidth(next)
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }, [rightWidth])

  return (
    <div className={styles.layout} data-mobile-tab={activeTab}>
      <div
        className={styles.leftPane}
        style={{ width: leftCollapsed ? 0 : leftWidth }}
      >
        <VirtualSetPanel />
      </div>
      <div
        className={`${styles.resizeHandleWrapper} ${leftCollapsed ? styles.resizeHandleCollapsed : ''}`}
        onMouseDown={handleResizeMouseDown}
      >
        <button
          className={styles.collapseToggle}
          onClick={() => setLeftCollapsed(c => !c)}
          onMouseDown={e => e.stopPropagation()}
          title={leftCollapsed ? '左ペインを展開' : '左ペインを折りたたむ'}
        >
          {leftCollapsed ? '›' : '‹'}
        </button>
      </div>
      <div className={styles.centerPane}>
        <PreviewPanel />
      </div>
      <div
        className={styles.rightResizeHandle}
        onMouseDown={handleRightResizeMouseDown}
      />
      <div className={styles.rightPane} style={{ width: rightWidth }}>
        <LayerTreePanel />
      </div>

      {/* モバイル用ボトムタブバー */}
      <nav className={styles.mobileTabBar}>
        <button
          className={`${styles.mobileTab} ${activeTab === 'virtual' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('virtual')}
        >
          <span className={styles.mobileTabIcon}>⊞</span>
          <span className={styles.mobileTabLabel}>仮想セル</span>
        </button>
        <button
          className={`${styles.mobileTab} ${activeTab === 'preview' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          <span className={styles.mobileTabIcon}>◧</span>
          <span className={styles.mobileTabLabel}>プレビュー</span>
        </button>
        <button
          className={`${styles.mobileTab} ${activeTab === 'layer' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('layer')}
        >
          <span className={styles.mobileTabIcon}>☰</span>
          <span className={styles.mobileTabLabel}>レイヤー</span>
        </button>
      </nav>
    </div>
  )
}
