import { VirtualSetPanel } from './VirtualSetPanel'
import { PreviewPanel } from './PreviewPanel'
import { LayerTreePanel } from './LayerTreePanel'
import styles from './MainLayout.module.css'

export function MainLayout() {
  return (
    <div className={styles.layout}>
      <VirtualSetPanel />
      <PreviewPanel />
      <LayerTreePanel />
    </div>
  )
}
