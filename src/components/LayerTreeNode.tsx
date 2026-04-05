import { useCallback, useState } from 'react'
import { useAppStore } from '../store'
import type { CspLayer, VirtualSet } from '../types'
import { isUnsupportedBlendMode } from '../engine/compositor'
import { useDragSource, getActiveDragPayload } from '../hooks/useDragDrop'
import { Tooltip } from './Tooltip'
import styles from './LayerTreeNode.module.css'

// 目玉アイコンをなぞって一括トグルするためのモジュールレベルドラッグ状態
// targetHidden: ドラッグ開始時に決定した「適用する非表示状態」
const visibilityDrag = { active: false, targetHidden: false }
if (typeof window !== 'undefined') {
  window.addEventListener('mouseup', () => { visibilityDrag.active = false })
}

interface LayerTreeNodeProps {
  layer: CspLayer
  selectedLayerId: string | null
  onSelect: (id: string) => void
  onToggleVisibility: (id: string) => void
  onToggleExpanded: (id: string) => void
  onToggleExpandedRecursive: (id: string) => void
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
  onToggleExpandedRecursive,
  onToggleMark,
  expandedFolders,
  visibilityOverrides,
  isCell = false,
  animParentId,
}: LayerTreeNodeProps) {
  const singleMarks = useAppStore(s => s.singleMarks)
  const manualAnimFolderIds = useAppStore(s => s.manualAnimFolderIds)
  const selectedCells = useAppStore(s => s.selectedCells)
  const selectAnimCell = useAppStore(s => s.selectAnimCell)
  const setFocusedAnimFolder = useAppStore(s => s.setFocusedAnimFolder)
  const focusedAnimFolderId = useAppStore(s => s.focusedAnimFolderId)
  const virtualSets = useAppStore(s => s.virtualSets)
  const updateVirtualSet = useAppStore(s => s.updateVirtualSet)
  // 仮想セットドロップ時の挿入ライン表示状態（'above' | 'below' | null）
  const [insertPosition, setInsertPosition] = useState<'above' | 'below' | null>(null)

  const { draggable, onDragStart, onDragEnd } = useDragSource({ type: 'layer', layerId: layer.id })

  const isSelected = selectedLayerId === layer.id
  // override があればその値、なければ PSD の hidden/uiHidden 両方を考慮した実効的な非表示状態
  const isUiHidden = visibilityOverrides.has(layer.id)
    ? visibilityOverrides.get(layer.id)!
    : (layer.hidden || layer.uiHidden)
  const isHidden = isUiHidden
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
        const idx = animFolder.children.findIndex(c => c.id === layer.id)
        if (idx >= 0) {
          selectAnimCell(animParentId, idx)
          setFocusedAnimFolder(animParentId)
        }
      }
      onSelect(layer.id)
    } else if (layer.autoMarked || layer.singleMark) {
      // autoMarked/singleMark クリック時: アニメフォーカス・仮想セット選択をクリアして出力プレビューを表示
      onSelect(layer.id)
      setFocusedAnimFolder(null)
    } else {
      onSelect(layer.id)
    }
  }, [layer, isCell, animParentId, onSelect, selectAnimCell, setFocusedAnimFolder])

  const handleVisibilityMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault() // テキスト選択を防ぐ
    visibilityDrag.active = true
    visibilityDrag.targetHidden = !isUiHidden // 現在の逆状態をドラッグ中の適用値とする
    onToggleVisibility(layer.id)
  }, [layer.id, isUiHidden, onToggleVisibility])

  const handleVisibilityMouseEnter = useCallback((e: React.MouseEvent) => {
    if (!visibilityDrag.active) return
    e.stopPropagation()
    // ドラッグ中は targetHidden と現在の状態が違う場合のみ適用（同じなら skip）
    if (isUiHidden !== visibilityDrag.targetHidden) {
      onToggleVisibility(layer.id)
    }
  }, [layer.id, isUiHidden, onToggleVisibility])

  const handleExpandClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.altKey) {
      onToggleExpandedRecursive(layer.id)
    } else {
      onToggleExpanded(layer.id)
    }
  }, [layer.id, onToggleExpanded, onToggleExpandedRecursive])

  const handleMarkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleMark(layer.id)
  }, [layer.id, onToggleMark])


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
  else if (isCell) nameClass = `${styles.name} ${styles.nameCell}`

  const isCellActive = isCell && animParentId != null && (() => {
    if (focusedAnimFolderId !== animParentId) return false
    const { layerTree } = useAppStore.getState()
    const animFolder = findLayerById(layerTree, animParentId)
    if (!animFolder) return false
    const idx = animFolder.children.findIndex(c => c.id === layer.id)
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
            <svg
              className={`${styles.expandChevron} ${isExpanded ? styles.expandChevronOpen : ''}`}
              viewBox="0 0 10 10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M3 2 L7 5 L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <div className={styles.expandPlaceholder} />
        )}

        <Tooltip content={isUiHidden ? 'プレビューに表示する' : 'プレビューから非表示にする'}>
          <button
            className={styles.visibilityBtn}
            onMouseDown={handleVisibilityMouseDown}
            onMouseEnter={handleVisibilityMouseEnter}
          >
            {isUiHidden ? '' : '👁'}
          </button>
        </Tooltip>

        <span className={`${styles.typeIcon} ${isCell ? styles.typeIconCell : ''}`}>{typeIcon}</span>

        <span className={nameClass} title={layer.originalName}>
          {layer.autoMarked ? layer.originalName : (layer.name || layer.originalName)}
        </span>

        {isUnsupportedBlendMode(layer.blendMode) && (
          <Tooltip content={`合成モード「${layer.blendMode}」は未対応のため通常合成で代替されます`}>
            <span className={styles.blendWarn}>⚠</span>
          </Tooltip>
        )}

        {!layer.autoMarked && !layer.isAnimationFolder && (
          <Tooltip content={isMarked
            ? '単体書き出しのマークを解除する'
            : 'このレイヤーを単体書き出し対象にマークする\nタイムライン登録なしでも出力される'
          }>
            <button
              className={`${styles.markBtn} ${isMarked ? styles.markBtnActive : ''}`}
              onClick={handleMarkClick}
            >
              ★
            </button>
          </Tooltip>
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
              onToggleExpandedRecursive={onToggleExpandedRecursive}
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
