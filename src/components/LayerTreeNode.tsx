import { useCallback, useState } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n'
import type { BlendMode, CspLayer, VirtualSet } from '../types'
import { useDragSource, getActiveDragPayload } from '../hooks/useDragDrop'
import styles from './LayerTreeNode.module.css'

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: '通常' },
  { value: 'pass through', label: '通過' },
  { value: 'multiply', label: '乗算' },
  { value: 'screen', label: 'スクリーン' },
  { value: 'overlay', label: 'オーバーレイ' },
  { value: 'darken', label: '暗く' },
  { value: 'lighten', label: '明るく' },
  { value: 'color dodge', label: '覆い焼き' },
  { value: 'color burn', label: '焼き込み' },
  { value: 'hard light', label: 'ハードライト' },
  { value: 'soft light', label: 'ソフトライト' },
  { value: 'difference', label: '差の絶対値' },
  { value: 'exclusion', label: '除外' },
  { value: 'hue', label: '色相' },
  { value: 'saturation', label: '彩度' },
  { value: 'color', label: 'カラー' },
  { value: 'luminosity', label: '輝度' },
]

interface LayerTreeNodeProps {
  layer: CspLayer
  selectedLayerId: string | null
  onSelect: (id: string) => void
  onToggleVisibility: (id: string) => void
  onToggleExpanded: (id: string) => void
  onToggleMark: (id: string) => void
  expandedFolders: Set<string>
  visibilityOverrides: Map<string, boolean>
  isCell?: boolean
  animParentId?: string
}

/** 仮想セットのインライン表示バッジ */
function VirtualSetBadge({ vs, indentWidth, onClear }: {
  vs: VirtualSet
  indentWidth: number
  onClear: () => void
}) {
  const setSelectedVirtualSet = useAppStore(s => s.setSelectedVirtualSet)
  const { draggable, onDragStart, onDragEnd } = useDragSource({ type: 'virtualSet', virtualSetId: vs.id })

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.stopPropagation()
    onDragStart(e)
  }, [onDragStart])

  return (
    <div
      className={styles.vsBadge}
      onClick={e => { e.stopPropagation(); setSelectedVirtualSet(vs.id) }}
      title={vs.name}
    >
      <div className={styles.vsBadgeIndent} style={{ width: indentWidth }} />
      {/* ドラッグハンドル：ドラッグして挿入位置を変更 */}
      <span
        className={styles.vsBadgeDragHandle}
        draggable={draggable}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        title="ドラッグして挿入位置を変更"
      >
        ⠿
      </span>
      <span className={styles.vsBadgeIcon}>⊞</span>
      <span className={styles.vsBadgeName}>{vs.name}</span>
      <button
        className={styles.vsBadgeClear}
        onClick={e => { e.stopPropagation(); onClear() }}
        title="挿入位置をクリア"
      >
        ✕
      </button>
    </div>
  )
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
  animParentId,
}: LayerTreeNodeProps) {
  const singleMarks = useAppStore(s => s.singleMarks)
  const manualAnimFolderIds = useAppStore(s => s.manualAnimFolderIds)
  const toggleManualAnimFolder = useAppStore(s => s.toggleManualAnimFolder)
  const selectedCells = useAppStore(s => s.selectedCells)
  const selectAnimCell = useAppStore(s => s.selectAnimCell)
  const setFocusedAnimFolder = useAppStore(s => s.setFocusedAnimFolder)
  const focusedAnimFolderId = useAppStore(s => s.focusedAnimFolderId)
  const setLayerBlendMode = useAppStore(s => s.setLayerBlendMode)
  const virtualSets = useAppStore(s => s.virtualSets)
  const updateVirtualSet = useAppStore(s => s.updateVirtualSet)
  const { t } = useLocale()

  // 仮想セットドロップ時の挿入ライン表示状態（'above' | 'below' | null）
  const [insertPosition, setInsertPosition] = useState<'above' | 'below' | null>(null)

  const { draggable, onDragStart, onDragEnd } = useDragSource({ type: 'layer', layerId: layer.id })

  const isSelected = selectedLayerId === layer.id
  const isUiHidden = visibilityOverrides.get(layer.id) ?? layer.uiHidden
  const isHidden = layer.hidden || isUiHidden
  const isExpanded = expandedFolders.has(layer.id)
  const isMarked = layer.autoMarked || singleMarks.has(layer.id)
  const isAnimFolder = layer.isAnimationFolder || manualAnimFolderIds.has(layer.id)

  // このレイヤーに挿入位置が設定されている仮想セットを取得
  const vsAbove = virtualSets.filter(vs => vs.insertionLayerId === layer.id && vs.insertionPosition === 'above')
  const vsBelow = virtualSets.filter(vs => vs.insertionLayerId === layer.id && vs.insertionPosition === 'below')

  const handleRowClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (isCell && animParentId) {
      const { layerTree } = useAppStore.getState()
      const animFolder = findLayerById(layerTree, animParentId)
      if (animFolder) {
        const idx = animFolder.children.indexOf(layer)
        if (idx >= 0) {
          selectAnimCell(animParentId, idx)
          setFocusedAnimFolder(animParentId)
        }
      }
    } else {
      onSelect(layer.id)
    }
  }, [layer, isCell, animParentId, onSelect, selectAnimCell, setFocusedAnimFolder])

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

  const handleAnimFolderToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    toggleManualAnimFolder(layer.id)
  }, [layer.id, toggleManualAnimFolder])

  const handleBlendModeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation()
    setLayerBlendMode(layer.id, e.target.value as BlendMode)
  }, [layer.id, setLayerBlendMode])

  // 仮想セットのドラッグオーバー：上半分 → 'above'、下半分 → 'below'
  const handleDragOver = useCallback((e: React.DragEvent) => {
    const payload = getActiveDragPayload()
    if (payload?.type !== 'virtualSet') return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setInsertPosition(e.clientY - rect.top < rect.height / 2 ? 'above' : 'below')
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // currentTarget の外に出たときだけクリア
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setInsertPosition(null)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    const payload = getActiveDragPayload()
    if (payload?.type !== 'virtualSet' || !insertPosition) return
    e.preventDefault()
    e.stopPropagation()
    updateVirtualSet(payload.virtualSetId, {
      insertionLayerId: layer.id,
      insertionPosition: insertPosition,
    })
    setInsertPosition(null)
  }, [layer.id, insertPosition, updateVirtualSet])

  const indentWidth = layer.depth * 16

  let typeIcon = '🖼'
  if (isAnimFolder) typeIcon = '🎬'
  else if (isCell) typeIcon = '🎞'
  else if (layer.isFolder) typeIcon = '📁'

  let nameClass = styles.name
  if (isAnimFolder) nameClass = `${styles.name} ${styles.nameAnim}`
  else if (layer.autoMarked) nameClass = `${styles.name} ${styles.nameAutoMark}`

  const isCellActive = isCell && animParentId != null && (() => {
    if (focusedAnimFolderId !== animParentId) return false
    const { layerTree } = useAppStore.getState()
    const animFolder = findLayerById(layerTree, animParentId)
    if (!animFolder) return false
    const idx = animFolder.children.indexOf(layer)
    return (selectedCells.get(animParentId) ?? 0) === idx
  })()

  const rowClass = [
    styles.row,
    isSelected ? styles.rowSelected : '',
    isCellActive ? styles.rowCellActive : '',
    isHidden ? styles.rowHidden : '',
    insertPosition ? styles.rowDropTarget : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={styles.node}>
      {/* このレイヤーの上に挿入される仮想セットのバッジ */}
      {vsAbove.map(vs => (
        <VirtualSetBadge
          key={vs.id}
          vs={vs}
          indentWidth={indentWidth}
          onClear={() => updateVirtualSet(vs.id, { insertionLayerId: null, insertionPosition: 'above' })}
        />
      ))}

      {/* 仮想セットドラッグ中の挿入ライン（上） */}
      {insertPosition === 'above' && (
        <div className={styles.insertionLine} style={{ marginLeft: indentWidth }} />
      )}

      <div
        className={rowClass}
        onClick={handleRowClick}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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

        {/* 合成モード変更 */}
        <select
          className={styles.blendSelect}
          value={layer.blendMode}
          onChange={handleBlendModeChange}
          onClick={e => e.stopPropagation()}
          title="合成モード"
        >
          {BLEND_MODES.filter(m => layer.isFolder || m.value !== 'pass through').map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        {/* アニメーションフォルダ手動トグル */}
        {layer.isFolder && !layer.isAnimationFolder && (
          <button
            className={`${styles.animBtn} ${manualAnimFolderIds.has(layer.id) ? styles.animBtnActive : ''}`}
            onClick={handleAnimFolderToggle}
            title={manualAnimFolderIds.has(layer.id) ? 'アニメーションフォルダ解除' : 'アニメーションフォルダとして指定'}
          >
            🎬
          </button>
        )}

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

      {/* 仮想セットドラッグ中の挿入ライン（下） */}
      {insertPosition === 'below' && (
        <div className={styles.insertionLine} style={{ marginLeft: indentWidth }} />
      )}

      {/* このレイヤーの下に挿入される仮想セットのバッジ */}
      {vsBelow.map(vs => (
        <VirtualSetBadge
          key={vs.id}
          vs={vs}
          indentWidth={indentWidth}
          onClear={() => updateVirtualSet(vs.id, { insertionLayerId: null, insertionPosition: 'above' })}
        />
      ))}

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
              isCell={isAnimFolder}
              animParentId={isAnimFolder ? layer.id : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function findLayerById(layers: CspLayer[], id: string): CspLayer | null {
  for (const l of layers) {
    if (l.id === id) return l
    const found = findLayerById(l.children, id)
    if (found) return found
  }
  return null
}
