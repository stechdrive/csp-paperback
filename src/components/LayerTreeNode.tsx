import { useCallback } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n'
import type { CspLayer } from '../types'
import { useDragSource } from '../hooks/useDragDrop'
import styles from './LayerTreeNode.module.css'

interface LayerTreeNodeProps {
  layer: CspLayer
  selectedLayerId: string | null
  onSelect: (id: string) => void
  onToggleVisibility: (id: string) => void
  onToggleExpanded: (id: string) => void
  onToggleMark: (id: string) => void
  expandedFolders: Set<string>
  visibilityOverrides: Map<string, boolean>
  isCell?: boolean  // アニメーションフォルダの直接の子（セル）かどうか
}

export function LayerTreeNode({
  layer,
  selectedLayerId,
  onSelect,
  onToggleVisibility,
  onToggleExpanded,
  onToggleMark,
  expandedFolders,
  visibilityOverrides,
  isCell = false,
}: LayerTreeNodeProps) {
  const singleMarks = useAppStore(s => s.singleMarks)
  const manualAnimFolderIds = useAppStore(s => s.manualAnimFolderIds)
  const { t } = useLocale()

  const { draggable, onDragStart, onDragEnd } = useDragSource({ type: 'layer', layerId: layer.id })

  const isSelected = selectedLayerId === layer.id
  const isUiHidden = visibilityOverrides.get(layer.id) ?? layer.uiHidden
  const isHidden = layer.hidden || isUiHidden
  const isExpanded = expandedFolders.has(layer.id) || layer.expanded
  const isMarked = layer.autoMarked || singleMarks.has(layer.id)
  const isAnimFolder = layer.isAnimationFolder || manualAnimFolderIds.has(layer.id)

  const handleRowClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(layer.id)
  }, [layer.id, onSelect])

  const handleVisibilityClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleVisibility(layer.id)
  }, [layer.id, onToggleVisibility])

  const handleExpandClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleExpanded(layer.id)
  }, [layer.id, onToggleExpanded])

  const handleMarkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleMark(layer.id)
  }, [layer.id, onToggleMark])

  const indentWidth = layer.depth * 16

  let typeIcon = '🖼'
  if (isAnimFolder) typeIcon = '🎬'
  else if (isCell) typeIcon = '🎞'    // アニメフォルダ直下のセル（フォルダ・単独レイヤー問わず）
  else if (layer.isFolder) typeIcon = '📁'

  let nameClass = styles.name
  if (isAnimFolder) nameClass = `${styles.name} ${styles.nameAnim}`
  else if (layer.autoMarked) nameClass = `${styles.name} ${styles.nameAutoMark}`

  const rowClass = [
    styles.row,
    isSelected ? styles.rowSelected : '',
    isHidden ? styles.rowHidden : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={styles.node}>
      <div
        className={rowClass}
        onClick={handleRowClick}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className={styles.indent} style={{ width: indentWidth }} />

        {layer.isFolder ? (
          <button className={styles.expandBtn} onClick={handleExpandClick}>
            {isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <div className={styles.expandPlaceholder} />
        )}

        <button className={styles.visibilityBtn} onClick={handleVisibilityClick}>
          {isUiHidden ? '🚫' : '👁'}
        </button>

        <span className={styles.typeIcon}>{typeIcon}</span>

        <span className={nameClass} title={layer.originalName}>
          {layer.name || layer.originalName}
        </span>

        {!layer.autoMarked && (
          <button
            className={`${styles.markBtn} ${isMarked ? styles.markBtnActive : ''}`}
            onClick={handleMarkClick}
            title={isMarked ? t.layerTree.unmarkTitle : t.layerTree.markTitle}
          >
            ★
          </button>
        )}
      </div>

      {layer.isFolder && isExpanded && layer.children.length > 0 && (
        <div className={styles.children}>
          {layer.children.map(child => (
            <LayerTreeNode
              key={child.id}
              layer={child}
              selectedLayerId={selectedLayerId}
              onSelect={onSelect}
              onToggleVisibility={onToggleVisibility}
              onToggleExpanded={onToggleExpanded}
              onToggleMark={onToggleMark}
              expandedFolders={expandedFolders}
              visibilityOverrides={visibilityOverrides}
              isCell={isAnimFolder}  // アニメフォルダの直接の子だけisCell=true
            />
          ))}
        </div>
      )}
    </div>
  )
}
