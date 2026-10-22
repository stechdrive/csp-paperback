import { memo, useCallback, useRef, useState } from 'react'
import { useAppStore } from '../store'
import type { CspLayer, VirtualSet } from '../types'
import {
  useDragSource,
  getActiveDragPayload,
  useInternalDropTarget,
  type DragPayload,
} from '../hooks/useDragDrop'
import {
  resolveVirtualSetFolderChildInsertionTarget,
  resolveVirtualSetInsertionTarget,
  type VirtualSetInsertionPosition,
} from '../utils/virtual-set-insertion'
import { isAutoMarkedContainerOutputSuppressed } from '../utils/auto-marked-container'
import { Tooltip } from './Tooltip'
import { LayerOutputName } from './LayerOutputName'
import { LayerDiagnosticWarning } from './DiagnosticWarning'
import { LayerTreeRow, LayerVisibility } from './LayerTreeRow'
import { LayerAnimationButton, LayerIndividualButton } from './LayerOutputButtons'
import styles from './LayerTree.module.css'
import type { HistoryOptions } from '../store/history-slice'
import { selectLayerVirtualInsertions, selectOutputRowStatuses } from '../store/selectors'
import { visibilityDrag } from '../utils/visibility-gesture'

type DropPlacement = VirtualSetInsertionPosition | 'inside'
const FOLDER_INSIDE_ZONE_START = 0.35
const FOLDER_INSIDE_ZONE_END = 0.65

interface LayerTreeNodeProps {
  editingNameId?: string | null
  onEditName?: (id: string) => void
  onFinishName?: (restoreFocus: boolean) => void
  layer: CspLayer
  onSelect: (id: string) => void
  onToggleVisibility: (id: string, options?: HistoryOptions) => void
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
  cellIndex?: number
}

function getDropPlacementFromPointer(clientY: number, rect: DOMRect, layer: CspLayer): DropPlacement {
  const ratio = (clientY - rect.top) / rect.height
  if (layer.isFolder && layer.children.length > 0) {
    if (ratio < FOLDER_INSIDE_ZONE_START) return 'above'
    if (ratio > FOLDER_INSIDE_ZONE_END) return 'below'
    return 'inside'
  }
  return ratio < 0.5 ? 'above' : 'below'
}

function isInsertionLineTarget(target: EventTarget | null, node: HTMLElement | null): boolean {
  if (!(target instanceof Element) || !node) return false
  const line = target.closest('[data-virtual-set-drop-line="true"]')
  return !!line && node.contains(line)
}

function VirtualSetInsertionLine({
  indentWidth,
  placement,
  onHover,
  onLeave,
  onDropVirtualSet,
}: {
  indentWidth: number
  placement: DropPlacement
  onHover: (placement: DropPlacement) => void
  onLeave: () => void
  onDropVirtualSet: (virtualSetId: string, placement: DropPlacement) => void
}) {
  const dropVirtualSet = useCallback((payload: DragPayload) => {
    if (payload.type !== 'virtualSet') return
    onDropVirtualSet(payload.virtualSetId, placement)
  }, [onDropVirtualSet, placement])

  const { dropRef } = useInternalDropTarget({
    canDrop: payload => payload.type === 'virtualSet',
    onDragOver: () => onHover(placement),
    onDragLeave: onLeave,
    onDrop: payload => {
      dropVirtualSet(payload)
      onLeave()
    },
  })

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const payload = getActiveDragPayload()
    if (payload?.type !== 'virtualSet') return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    onHover(placement)
  }, [onHover, placement])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    onLeave()
  }, [onLeave])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const payload = getActiveDragPayload()
    if (payload?.type !== 'virtualSet') return
    e.preventDefault()
    e.stopPropagation()
    dropVirtualSet(payload)
    onLeave()
  }, [dropVirtualSet, onLeave])

  return (
    <div
      ref={dropRef}
      className={styles.insertionLine}
      style={{ marginLeft: indentWidth }}
      data-virtual-set-drop-line="true"
      aria-hidden="true"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    />
  )
}

/** 仮想セットのインライン表示バッジ */
function VirtualSetBadge({ vs, indentWidth, onClear }: {
  vs: VirtualSet
  indentWidth: number
  onClear: () => void
}) {
  const setSelectedVirtualSet = useAppStore(s => s.setSelectedVirtualSet)
  const { draggable, onDragStart, onDragEnd, onPointerDown } = useDragSource({ type: 'virtualSet', virtualSetId: vs.id })

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.stopPropagation()
    onDragStart(e)
  }, [onDragStart])

  return (
    <Tooltip content={vs.name}><div data-tooltip={vs.name}
      className={styles.vsBadge}
      data-virtual-set-id={vs.id}
      onClick={e => { e.stopPropagation(); setSelectedVirtualSet(vs.id) }}
    >
      <div className={styles.vsBadgeIndent} style={{ width: indentWidth }} />
      {/* ドラッグハンドル：ドラッグして挿入位置を変更 */}
      <Tooltip content="ドラッグして挿入位置を変更"><span data-tooltip="ドラッグして挿入位置を変更"
        className={styles.vsBadgeDragHandle}
        draggable={draggable}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onPointerDown={onPointerDown}
      >
        ⠿
      </span></Tooltip>
      <span className={styles.vsBadgeIcon}>⊞</span>
      <span className={styles.vsBadgeName}>{vs.name}</span>
      <Tooltip content="挿入位置をクリア"><button aria-label="挿入位置をクリア" data-tooltip="挿入位置をクリア"
        className={styles.vsBadgeClear}
        onClick={e => { e.stopPropagation(); onClear() }}
      >
        ✕
      </button></Tooltip>
    </div></Tooltip>
  )
}

export const LayerTreeNode = memo(function LayerTreeNodeView({
  editingNameId,
  onEditName,
  onFinishName,
  layer,
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
  cellIndex,
}: LayerTreeNodeProps) {
  const outputStatus = useAppStore(s => selectOutputRowStatuses(s).get(layer.id))
  const isSelected = useAppStore(s => s.selectedLayerId === layer.id)
  const hasSingleMark = useAppStore(s => s.singleMarks.has(layer.id))
  const isManualAnimFolder = useAppStore(s => s.manualAnimFolderIds.has(layer.id))
  const hasAnimDescendant = useAppStore(s => layer.isFolder && !isCell && hasEffectiveAnimDescendant(layer, s.manualAnimFolderIds))
  const isCellActive = useAppStore(s => isCell && animParentId != null && s.focusedAnimFolderId === animParentId &&
    (s.selectedCells.get(animParentId) ?? 0) === cellIndex)
  const { above: vsAbove, below: vsBelow } = useAppStore(s => selectLayerVirtualInsertions(s, layer.id))
  const updateVirtualSet = useAppStore(s => s.updateVirtualSet)
  // 仮想セットドロップ時の挿入ライン表示状態（'above' | 'inside' | 'below' | null）
  const [dropPlacement, setDropPlacement] = useState<DropPlacement | null>(null)
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const visibilityMouseHandled = useRef(false)

  const { draggable, onDragStart, onDragEnd, onPointerDown } = useDragSource({ type: 'layer', layerId: layer.id })

  // override があればその値、なければ PSD の hidden/uiHidden 両方を考慮した実効的な非表示状態
  const isUiHidden = visibilityOverrides.has(layer.id)
    ? visibilityOverrides.get(layer.id)!
    : (layer.hidden || layer.uiHidden)
  const isExpanded = expandedFolders.has(layer.id)
  const isTransientExpanded = !!transientExpandedFolders?.has(layer.id)
  const isAutoMarkedContainerSuppressed = isAutoMarkedContainerOutputSuppressed(layer)
  const isOutputAutoMarked = layer.autoMarked && !isAutoMarkedContainerSuppressed
  const isMarked = isOutputAutoMarked || hasSingleMark
  const isXdtsAnimFolder = layer.animationFolder?.detectedBy === 'xdts' || layer.animationFolder?.detectedBy === 'clip'
  const isAutoProcessAnimFolder = layer.animationFolder?.detectedBy === 'autoProcess'
  const isAnimFolder = layer.isAnimationFolder || (layer.isFolder && isManualAnimFolder)
  const canToggleManualAnimFolder = layer.isFolder &&
    !isCell &&
    !isXdtsAnimFolder &&
    (isManualAnimFolder || !hasAnimDescendant)
  const visibilityLabel = isUiHidden ? 'レイヤーを表示する' : 'レイヤーを非表示にする'

  const handleRowClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(layer.id)
  }, [layer.id, onSelect])

  const handleVisibilityMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return
    e.preventDefault() // テキスト選択を防ぐ
    visibilityMouseHandled.current = true
    visibilityDrag.active = true
    visibilityDrag.targetHidden = !isUiHidden // 現在の逆状態をドラッグ中の適用値とする
    onToggleVisibility(layer.id)
  }, [layer.id, isUiHidden, onToggleVisibility])

  const handleVisibilityMouseEnter = useCallback((e: React.MouseEvent) => {
    if (!visibilityDrag.active) return
    e.stopPropagation()
    // ドラッグ中は targetHidden と現在の状態が違う場合のみ適用（同じなら skip）
    if (isUiHidden !== visibilityDrag.targetHidden) {
      onToggleVisibility(layer.id, { recordHistory: false })
    }
  }, [layer.id, isUiHidden, onToggleVisibility])

  const handleExpandClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // 視覚状態（仮展開も含む）の反対方向に切り替える。
    // 手動設定と現在の一時展開を更新。次の巡回は必要な経路を再度開く。
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

  const updateVirtualSetInsertion = useCallback((virtualSetId: string, placement: DropPlacement) => {
    const tree = useAppStore.getState().layerTree
    const target = placement === 'inside'
      ? resolveVirtualSetFolderChildInsertionTarget(tree, layer.id)
      : resolveVirtualSetInsertionTarget(tree, layer.id, placement)
    if (!target) return
    updateVirtualSet(virtualSetId, target)
  }, [layer.id, updateVirtualSet])

  // 仮想セットのドラッグオーバー：フォルダ中央は配下、上下端は同階層の挿入ライン
  const handleDragOver = useCallback((e: React.DragEvent) => {
    const payload = getActiveDragPayload()
    if (payload?.type !== 'virtualSet') return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDropPlacement(getDropPlacementFromPointer(e.clientY, rect, layer))
  }, [layer])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (isInsertionLineTarget(e.relatedTarget, nodeRef.current)) return
    setDropPlacement(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    const payload = getActiveDragPayload()
    if (payload?.type !== 'virtualSet') return
    e.preventDefault()
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    updateVirtualSetInsertion(payload.virtualSetId, getDropPlacementFromPointer(e.clientY, rect, layer))
    setDropPlacement(null)
  }, [layer, updateVirtualSetInsertion])

  const { dropRef: internalDropRef } = useInternalDropTarget({
    canDrop: payload => payload.type === 'virtualSet',
    onDragOver: (_payload, position) => {
      const rect = rowRef.current?.getBoundingClientRect()
      if (!rect) return
      setDropPlacement(getDropPlacementFromPointer(position.clientY, rect, layer))
    },
    onDragLeave: () => setDropPlacement(null),
    onDrop: (payload, position) => {
      if (payload.type !== 'virtualSet') return
      const rect = rowRef.current?.getBoundingClientRect()
      if (!rect) return
      updateVirtualSetInsertion(payload.virtualSetId, getDropPlacementFromPointer(position.clientY, rect, layer))
      setDropPlacement(null)
    },
  })

  const setRowRef = useCallback((node: HTMLDivElement | null) => {
    rowRef.current = node
    internalDropRef(node)
  }, [internalDropRef])

  const indentWidth = layer.depth * 12

  const childIndentWidth = layer.children[0]?.depth != null
    ? layer.children[0].depth * 12
    : indentWidth + 12

  return (
    <div ref={nodeRef} className={styles.node}>
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
      {dropPlacement === 'above' && (
        <VirtualSetInsertionLine
          indentWidth={indentWidth}
          placement="above"
          onHover={setDropPlacement}
          onLeave={() => setDropPlacement(null)}
          onDropVirtualSet={updateVirtualSetInsertion}
        />
      )}

      <LayerTreeRow
        ref={setRowRef}
        name={layer.originalName}
        depth={layer.depth}
        kind={isAnimFolder ? 'animation' : isCell ? 'cell' : layer.isFolder ? 'folder' : 'layer'}
        autoProcess={isAutoProcessAnimFolder}
        autoMarked={isOutputAutoMarked}
        dimmed={isUiHidden}
        selected={isSelected}
        activeCell={isCellActive}
        dropTarget={dropPlacement === 'inside'}
        expanded={isExpanded}
        transientExpanded={isTransientExpanded}
        onExpand={layer.isFolder ? handleExpandClick : undefined}
        renderName={nameClass => <LayerOutputName layer={layer} className={nameClass} editing={editingNameId === layer.id}
          onEdit={onEditName} onFinish={onFinishName} />}
        data-layer-id={layer.id}
        onClick={handleRowClick}
        draggable={editingNameId === layer.id ? false : draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onPointerDown={onPointerDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        visibility={<Tooltip content={visibilityLabel}>
          <LayerVisibility hidden={isUiHidden}
            onMouseDown={handleVisibilityMouseDown}
            onMouseEnter={handleVisibilityMouseEnter}
            onClick={event => {
              event.stopPropagation()
              // Keyboard activation has no preceding mouse-down.
              if (!visibilityMouseHandled.current && event.detail === 0) onToggleVisibility(layer.id)
              visibilityMouseHandled.current = false
            }}
            onKeyDown={() => { visibilityMouseHandled.current = false }}
          />
        </Tooltip>}
        status={<>
            {!!outputStatus?.excluded && <Tooltip content={`出力対象の設定で ${outputStatus.excluded} / ${outputStatus.total} 件をOFFにしています。レイヤーの表示状態は変わりません。`}>
              <span className={styles.outputStatus} data-layer-column="output-state" data-output-state={outputStatus.excluded === outputStatus.total ? 'off' : 'partial'}>
                {outputStatus.excluded === outputStatus.total ? '出力OFF' : '一部OFF'}
              </span>
            </Tooltip>}
            {layer.individualOutputExcludedBy && <Tooltip content={`自身または祖先フォルダが除外リスト「${layer.individualOutputExcludedBy}」に一致するため、自動の書き出し対象の検出と自動表示を行いません。手動指定・仮想セルでの使用や、表示中の共通素材としての合成は可能です。`}>
              <span className={styles.outputStatus} data-layer-column="exclusion" data-output-state="name-excluded">除外指定</span>
            </Tooltip>}
          <Tooltip content="元のレイヤーは非表示ですが、選択した出力の仮想セル内で使用しています。"><span className={styles.outputStatus} data-layer-virtual-use hidden>仮想セル</span></Tooltip>
        </>}
        controls={{
          warning: <LayerDiagnosticWarning layer={layer} />,
          animation: canToggleManualAnimFolder && (
            <LayerAnimationButton active={isManualAnimFolder} onClick={handleAnimClick} />
          ),
          individual: !isOutputAutoMarked && !layer.isAnimationFolder && (
            <LayerIndividualButton active={isMarked} onClick={handleMarkClick} />
          ),
        }}
      />

      {/* フォルダ配下に入る挿入ライン。行強調と短いラインで同階層挿入と区別する。 */}
      {dropPlacement === 'inside' && (
        <VirtualSetInsertionLine
          indentWidth={childIndentWidth}
          placement="inside"
          onHover={setDropPlacement}
          onLeave={() => setDropPlacement(null)}
          onDropVirtualSet={updateVirtualSetInsertion}
        />
      )}

      {layer.isFolder && isExpanded && layer.children.length > 0 && (
        <div className={styles.children}>
          {layer.children.map((child, index) => (
            <LayerTreeNode
              key={child.id}
              editingNameId={editingNameId}
              onEditName={onEditName}
              onFinishName={onFinishName}
              layer={child}
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
              cellIndex={isAnimFolder ? index : undefined}
            />
          ))}
        </div>
      )}

      {/* 仮想セットドラッグ中の挿入ライン（下） */}
      {dropPlacement === 'below' && (
        <VirtualSetInsertionLine
          indentWidth={indentWidth}
          placement="below"
          onHover={setDropPlacement}
          onLeave={() => setDropPlacement(null)}
          onDropVirtualSet={updateVirtualSetInsertion}
        />
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
    </div>
  )
})

function hasEffectiveAnimDescendant(layer: CspLayer, manualAnimFolderIds: Set<string>): boolean {
  for (const child of layer.children) {
    if (child.isAnimationFolder || manualAnimFolderIds.has(child.id)) return true
    if (hasEffectiveAnimDescendant(child, manualAnimFolderIds)) return true
  }
  return false
}
