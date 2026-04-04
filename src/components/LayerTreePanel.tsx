import { useAppStore } from '../store'
import { useLocale } from '../i18n'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import { LayerTreeNode } from './LayerTreeNode'
import styles from './LayerTreePanel.module.css'

export function LayerTreePanel() {
  const tree = useAppStore(selectLayerTreeWithVisibility)
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const expandedFolders = useAppStore(s => s.expandedFolders)
  const visibilityOverrides = useAppStore(s => s.visibilityOverrides)
  const { t } = useLocale()

  const selectLayer = useAppStore(s => s.selectLayer)
  const toggleLayerVisibility = useAppStore(s => s.toggleLayerVisibility)
  const toggleFolderExpanded = useAppStore(s => s.toggleFolderExpanded)
  const toggleSingleMark = useAppStore(s => s.toggleSingleMark)
  const resetVisibility = useAppStore(s => s.resetVisibility)

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{t.layerTree.title}</span>
        <button className={styles.resetBtn} onClick={resetVisibility}>
          {t.layerTree.resetVisibility}
        </button>
      </div>
      <div className={styles.tree}>
        {tree.length === 0 ? (
          <div className={styles.empty}>
            {t.layerTree.empty.split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
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
