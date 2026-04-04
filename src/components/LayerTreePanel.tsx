import { useAppStore } from '../store'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import { LayerTreeNode } from './LayerTreeNode'
import styles from './LayerTreePanel.module.css'

export function LayerTreePanel() {
  const tree = useAppStore(selectLayerTreeWithVisibility)
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const expandedFolders = useAppStore(s => s.expandedFolders)
  const visibilityOverrides = useAppStore(s => s.visibilityOverrides)

  const selectLayer = useAppStore(s => s.selectLayer)
  const toggleLayerVisibility = useAppStore(s => s.toggleLayerVisibility)
  const toggleFolderExpanded = useAppStore(s => s.toggleFolderExpanded)
  const toggleSingleMark = useAppStore(s => s.toggleSingleMark)
  const resetVisibility = useAppStore(s => s.resetVisibility)

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>レイヤー</span>
        <button className={styles.resetBtn} onClick={resetVisibility}>
          初期状態に戻す
        </button>
      </div>
      <div className={styles.tree}>
        {tree.length === 0 ? (
          <div className={styles.empty}>
            PSD を読み込むと<br />レイヤー構造が表示されます
          </div>
        ) : (
          tree.map(layer => (
            <LayerTreeNode
              key={layer.id}
              layer={layer}
              selectedLayerId={selectedLayerId}
              onSelect={selectLayer}
              onToggleVisibility={toggleLayerVisibility}
              onToggleExpanded={toggleFolderExpanded}
              onToggleMark={toggleSingleMark}
              expandedFolders={expandedFolders}
              visibilityOverrides={visibilityOverrides}
            />
          ))
        )}
      </div>
    </div>
  )
}
