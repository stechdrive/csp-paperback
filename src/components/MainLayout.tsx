import { useState, useCallback } from 'react'
import { VirtualSetPanel } from './VirtualSetPanel'
import { PreviewPanel } from './PreviewPanel'
import { LayerTreePanel } from './LayerTreePanel'
import styles from './MainLayout.module.css'

const LEFT_DEFAULT = 260
const LEFT_MIN = 200
const LEFT_MAX = 600

export function MainLayout() {
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT)

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
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
  }, [leftWidth])

  return (
    <div className={styles.layout}>
      <div className={styles.leftPane} style={{ width: leftWidth }}>
        <VirtualSetPanel />
      </div>
      <div className={styles.resizeHandle} onMouseDown={handleResizeMouseDown} />
      <div className={styles.centerPane}>
        <PreviewPanel />
      </div>
      <div className={styles.rightPane}>
        <LayerTreePanel />
      </div>
    </div>
  )
}
