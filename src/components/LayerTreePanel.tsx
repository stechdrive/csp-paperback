import { useCallback } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n'
import { selectLayerTreeWithVisibility, selectLayerById } from '../store/selectors'
import { LayerTreeNode } from './LayerTreeNode'
import { BlendOpacityBar } from './BlendOpacityBar'
import { Tooltip } from './Tooltip'
import type { BlendMode } from '../types'
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
  const setLayerBlendMode = useAppStore(s => s.setLayerBlendMode)
  const setLayerOpacity = useAppStore(s => s.setLayerOpacity)

  const selectedLayer = useAppStore(s => selectedLayerId ? selectLayerById(s, selectedLayerId) : null)

  const handleBlendModeChange = useCallback((value: string) => {
    if (!selectedLayerId) return
    setLayerBlendMode(selectedLayerId, value as BlendMode)
  }, [selectedLayerId, setLayerBlendMode])

  const handleOpacityChange = useCallback((value: number) => {
    if (!selectedLayerId) return
    setLayerOpacity(selectedLayerId, value)
  }, [selectedLayerId, setLayerOpacity])

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{t.layerTree.title}</span>
        <Tooltip content="すべての 👁 表示/非表示を元に戻す（出力には影響しません）">
          <button className={styles.resetBtn} onClick={resetVisibility}>
            {t.layerTree.resetVisibility}
          </button>
        </Tooltip>
      </div>

      {/* 選択レイヤーの合成モード・不透明度コントロール */}
      <BlendOpacityBar
        blendMode={selectedLayer?.blendMode ?? 'normal'}
        opacity={selectedLayer?.opacity ?? 100}
        disabled={!selectedLayer}
        showPassThrough={selectedLayer?.isFolder ?? true}
        onBlendModeChange={handleBlendModeChange}
        onOpacityChange={handleOpacityChange}
      />

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
