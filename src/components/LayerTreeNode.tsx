import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
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
  onSetExpanded: (id: string, expanded: boolean) => void
  onSetExpandedRecursive: (id: string, expanded: boolean) => void
  onToggleMark: (id: string) => void
  onToggleAnimFolder: (id: string) => void
  expandedFolders: Set<string>
  /** Shift巡回で一時的に開いているだけのフォルダ（チェブロン視覚区別用） */
  transientExpandedFolders?: Set<string>
  visibilityOverrides: Map<string, boolean>
  isCell?: boolean
  animParentId?: string
}

function DocumentIcon() {
  return (
    <svg
      className={styles.docIcon}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4 2 H10 L13 5 V13 A1 1 0 0 1 12 14 H4 A1 1 0 0 1 3 13 V3 A1 1 0 0 1 4 2 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M10 2 V5 H13"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function VisibilityIcon() {
  return (
    <svg
      className={styles.visibilityIcon}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2.75 12C4.8 8.5 8.16 6.5 12 6.5C15.84 6.5 19.2 8.5 21.25 12C19.2 15.5 15.84 17.5 12 17.5C8.16 17.5 4.8 15.5 2.75 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.75"
        fill="currentColor"
      />
    </svg>
  )
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
      data-virtual-set-id={vs.id}
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
  onSetExpanded,
  onSetExpandedRecursive,
  onToggleMark,
  onToggleAnimFolder,
  expandedFolders,
  transientExpandedFolders,
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
  const isTransientExpanded = !!transientExpandedFolders?.has(layer.id)
  const isMarked = layer.autoMarked || singleMarks.has(layer.id)
  const isManualAnimFolder = manualAnimFolderIds.has(layer.id)
  const isXdtsAnimFolder = layer.animationFolder?.detectedBy === 'xdts'
  const isAutoProcessAnimFolder = layer.animationFolder?.detectedBy === 'autoProcess'
  const isAnimFolder = layer.isAnimationFolder || (layer.isFolder && isManualAnimFolder)
  const canToggleManualAnimFolder = layer.isFolder &&
    !isCell &&
    !isXdtsAnimFolder &&
    (isManualAnimFolder || !hasEffectiveAnimDescendant(layer, manualAnimFolderIds))

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
    } else if (isAnimFolder) {
      onSelect(layer.id)
      setFocusedAnimFolder(layer.id)
    } else if (layer.autoMarked || layer.singleMark) {
      // autoMarked/singleMark クリック時: アニメフォーカス・仮想セット選択をクリアして出力プレビューを表示
      onSelect(layer.id)
      setFocusedAnimFolder(null)
    } else {
      onSelect(layer.id)
    }
  }, [layer, isCell, animParentId, isAnimFolder, onSelect, selectAnimCell, setFocusedAnimFolder])

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
    // 視覚状態（仮展開も含む）の反対方向に切り替える。
    // 仮展開を閉じるときは userCollapsedFolders に記録され、以降の仮展開が抑制される。
    const nextExpanded = !isExpanded
    if (e.altKey) {
      onSetExpandedRecursive(layer.id, nextExpanded)
    } else {
      onSetExpanded(layer.id, nextExpanded)
    }
  }, [layer.id, isExpanded, onSetExpanded, onSetExpandedRecursive])

  const handleMarkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleMark(layer.id)
  }, [layer.id, onToggleMark])

  const handleAnimClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleAnimFolder(layer.id)
  }, [layer.id, onToggleAnimFolder])

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

  let typeIcon: ReactNode = <DocumentIcon />
  if (isAnimFolder) typeIcon = '🎬'
  else if (isCell) typeIcon = '🎞'
  else if (layer.isFolder) typeIcon = '📁'

  let nameClass = styles.name
  if (isAutoProcessAnimFolder) nameClass = `${styles.name} ${styles.nameAnimAutoProcess}`
  else if (isAnimFolder) nameClass = `${styles.name} ${styles.nameAnim}`
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
        data-layer-id={layer.id}
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
          <Tooltip content={isTransientExpanded
            ? 'Shift+スクロール巡回で自動展開中\nクリックで閉じるとこのフォルダは巡回されません'
            : ''
          }>
            <button className={styles.expandBtn} onClick={handleExpandClick}>
              <svg
                className={[
                  styles.expandChevron,
                  isExpanded ? styles.expandChevronOpen : '',
                  isTransientExpanded ? styles.expandChevronTransient : '',
                ].filter(Boolean).join(' ')}
                viewBox="0 0 10 10"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M3 2 L7 5 L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </Tooltip>
        ) : (
          <div className={styles.expandPlaceholder} />
        )}

        <Tooltip content={isUiHidden ? 'プレビューに表示する' : 'プレビューから非表示にする'}>
          <button
            type="button"
            className={`${styles.visibilityBtn} ${isUiHidden ? styles.visibilityBtnHidden : styles.visibilityBtnVisible}`}
            onMouseDown={handleVisibilityMouseDown}
            onMouseEnter={handleVisibilityMouseEnter}
            aria-label={isUiHidden ? 'プレビューに表示する' : 'プレビューから非表示にする'}
            aria-pressed={!isUiHidden}
          >
            {!isUiHidden && <VisibilityIcon />}
          </button>
        </Tooltip>

        <span className={`${styles.typeIcon} ${isCell ? styles.typeIconCell : ''} ${isAutoProcessAnimFolder ? styles.typeIconAutoProcess : ''}`}>{typeIcon}</span>

        <span className={nameClass} title={layer.originalName}>
          {(layer.autoMarked || isAutoProcessAnimFolder) ? layer.originalName : (layer.name || layer.originalName)}
        </span>

        {isUnsupportedBlendMode(layer.blendMode) && (
          <Tooltip content={`合成モード「${layer.blendMode}」は未対応のため通常合成で代替されます`}>
            <span className={styles.blendWarn}>⚠</span>
          </Tooltip>
        )}

        {canToggleManualAnimFolder && (
          <Tooltip content={isManualAnimFolder
            ? '手動アニメーションフォルダ指定を解除する'
            : 'このフォルダを手動でアニメーションフォルダとして扱う'
          }>
            <button
              className={`${styles.animBtn} ${isManualAnimFolder ? styles.animBtnActive : ''}`}
              onClick={handleAnimClick}
            >
              🎬
            </button>
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
              onSetExpanded={onSetExpanded}
              onSetExpandedRecursive={onSetExpandedRecursive}
              onToggleMark={onToggleMark}
              onToggleAnimFolder={onToggleAnimFolder}
              expandedFolders={expandedFolders}
              transientExpandedFolders={transientExpandedFolders}
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

function hasEffectiveAnimDescendant(layer: CspLayer, manualAnimFolderIds: Set<string>): boolean {
  for (const child of layer.children) {
    if (child.isAnimationFolder || manualAnimFolderIds.has(child.id)) return true
    if (hasEffectiveAnimDescendant(child, manualAnimFolderIds)) return true
  }
  return false
}
