import { useState, useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { selectLayerById } from '../store/selectors'
import {
  isInternalPointerDragEnabled,
  startInternalPointerDrag,
  useDragSource,
  useDropZone,
  useInternalDropTarget,
  type DragPayload,
} from '../hooks/useDragDrop'
import { Tooltip } from './Tooltip'
import type { HistoryOptions } from '../store/history-slice'
import type { CspLayer, VirtualSet } from '../types'
import styles from './VirtualSetItem.module.css'

interface VirtualSetItemProps {
  virtualSet: VirtualSet
}

// モジュールレベルのDnD状態
let _draggingMemberInfo: { setId: string; layerIds: string[] } | null = null

// 目玉アイコンなぞり一括トグル用ドラッグ状態（右ツリーと同じパターン）
// targetVisible: ドラッグ開始時に決定した「適用する表示状態」
const vsVisibilityDrag = { active: false, targetVisible: true }
if (typeof window !== 'undefined') {
  window.addEventListener('mouseup', () => { vsVisibilityDrag.active = false })
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`${styles.expandChevron} ${open ? styles.expandChevronOpen : ''}`}
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M3 2 L7 5 L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// =========================================================
// ミニツリー：フォルダ展開時の子ノード表示
// =========================================================
interface VsMemberNodeProps {
  layer: CspLayer
  vsId: string
  overrides: Record<string, boolean>
  expandedIds: Set<string>
  selectedLayerId: string | null
  onToggleExpand: (id: string) => void
  onToggleVisibility: (layerId: string, visible: boolean, options?: HistoryOptions) => void
  onSelectLayer: (layerId: string) => void
  depth: number
}

function VsMemberNode({
  layer,
  vsId,
  overrides,
  expandedIds,
  selectedLayerId,
  onToggleExpand,
  onToggleVisibility,
  onSelectLayer,
  depth,
}: VsMemberNodeProps) {
  // VS固有オーバーライドがあればそれを使い、なければレイヤー本来の状態を使う
  const visible = overrides[layer.id] ?? (!layer.hidden && !layer.uiHidden)
  const isExpanded = expandedIds.has(layer.id)
  const isSelected = selectedLayerId === layer.id

  return (
    <>
      <div
        className={`${styles.vsTreeNode} ${isSelected ? styles.vsTreeNodeSelected : ''} ${!visible ? styles.vsTreeNodeHidden : ''}`}
        style={{ paddingLeft: `${4 + depth * 14}px` }}
        onClick={e => {
          e.stopPropagation()
          onSelectLayer(layer.id)
        }}
      >
        {layer.isFolder ? (
          <button
            className={styles.vsExpandBtn}
            onClick={e => { e.stopPropagation(); onToggleExpand(layer.id) }}
          >
            <Chevron open={isExpanded} />
          </button>
        ) : (
          <div className={styles.vsExpandPlaceholder} />
        )}
        <button
          className={styles.vsVisibilityBtn}
          onMouseDown={e => {
            e.stopPropagation()
            e.preventDefault()
            vsVisibilityDrag.active = true
            vsVisibilityDrag.targetVisible = !visible
            onToggleVisibility(layer.id, !visible)
          }}
          onMouseEnter={e => {
            if (!vsVisibilityDrag.active) return
            e.stopPropagation()
            if (visible !== vsVisibilityDrag.targetVisible) {
              onToggleVisibility(layer.id, vsVisibilityDrag.targetVisible, { recordHistory: false })
            }
          }}
          title={visible ? '非表示にする' : '表示にする'}
        >
          {visible ? '👁' : ''}
        </button>
        <span className={styles.vsLayerName} title={layer.originalName}>
          {layer.name || layer.originalName}
        </span>
      </div>
      {layer.isFolder && isExpanded && layer.children.map(child => (
        <VsMemberNode
          key={child.id}
          layer={child}
          vsId={vsId}
          overrides={overrides}
          expandedIds={expandedIds}
          selectedLayerId={selectedLayerId}
          onToggleExpand={onToggleExpand}
          onToggleVisibility={onToggleVisibility}
          onSelectLayer={onSelectLayer}
          depth={depth + 1}
        />
      ))}
    </>
  )
}

// =========================================================
// メインコンポーネント
// =========================================================
export function VirtualSetItem({ virtualSet }: VirtualSetItemProps) {
  const updateVirtualSet = useAppStore(s => s.updateVirtualSet)
  const removeVirtualSet = useAppStore(s => s.removeVirtualSet)
  const addVirtualSetMember = useAppStore(s => s.addVirtualSetMember)
  const removeVirtualSetMember = useAppStore(s => s.removeVirtualSetMember)
  const reorderVirtualSetMembers = useAppStore(s => s.reorderVirtualSetMembers)
  const setVirtualSetVisibilityOverride = useAppStore(s => s.setVirtualSetVisibilityOverride)
  const pushHistory = useAppStore(s => s.pushHistory)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const setSelectedVirtualSet = useAppStore(s => s.setSelectedVirtualSet)
  const setSelectedVsMember = useAppStore(s => s.setSelectedVsMember)
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const selectedVsMemberSetId = useAppStore(s => s.selectedVsMemberSetId)
  const selectedVsMemberId = useAppStore(s => s.selectedVsMemberId)
  const isSelected = selectedVirtualSetId === virtualSet.id
  const selectedVirtualLayerId = selectedVsMemberSetId === virtualSet.id ? selectedVsMemberId : null
  const { t } = useLocale()

  // アイテム折りたたみ
  const [collapsed, setCollapsed] = useState(false)

  // 多選択状態
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)

  // メンバー行ドラッグ挿入ライン
  const [insertLineIndex, setInsertLineIndex] = useState<number | null>(null)
  const [insertLinePosition, setInsertLinePosition] = useState<'above' | 'below'>('below')

  // フォルダメンバーの展開状態（ミニツリー用）
  const [vsExpandedIds, setVsExpandedIds] = useState<Set<string>>(new Set())
  const nameEditStart = useRef(virtualSet.name)
  const nameHistoryPushed = useRef(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const autoSelectedNameId = useRef<string | null>(null)

  // 仮想セット自体をドラッグして右ペインに挿入位置を設定するためのドラッグソース
  const { draggable, onDragStart, onDragEnd, onPointerDown } = useDragSource({
    type: 'virtualSet',
    virtualSetId: virtualSet.id,
  })

  const onMemberDrop = useCallback((payload: DragPayload) => {
    if (payload.type === 'layer') {
      addVirtualSetMember(virtualSet.id, payload.layerId)
    }
  }, [virtualSet.id, addVirtualSetMember])

  const { dropHandlers: memberDropHandlers, dropRef: memberDropRef, isOver: memberIsOver } = useDropZone(onMemberDrop)
  const memberListRef = useRef<HTMLDivElement | null>(null)
  const memberNativeDraggable = !isInternalPointerDragEnabled()

  // 挿入位置の表示テキストを生成
  const state = useAppStore.getState()
  const insertionLayer = virtualSet.insertionLayerId
    ? selectLayerById(state, virtualSet.insertionLayerId)
    : null
  const insertionText = insertionLayer
    ? `${insertionLayer.name} の${virtualSet.insertionPosition === 'above' ? '上' : '下'}`
    : null

  // 選択中レイヤー（挿入位置を選択方式でセットするために参照）
  const selectedLayer = selectedLayerId ? selectLayerById(state, selectedLayerId) : null

  const handleSetInsertionAbove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!selectedLayerId) return
    updateVirtualSet(virtualSet.id, { insertionLayerId: selectedLayerId, insertionPosition: 'above' })
  }, [virtualSet.id, selectedLayerId, updateVirtualSet])

  const handleSetInsertionBelow = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!selectedLayerId) return
    updateVirtualSet(virtualSet.id, { insertionLayerId: selectedLayerId, insertionPosition: 'below' })
  }, [virtualSet.id, selectedLayerId, updateVirtualSet])

  const handleClearInsertion = useCallback(() => {
    updateVirtualSet(virtualSet.id, { insertionLayerId: null, insertionPosition: 'above' })
  }, [virtualSet.id, updateVirtualSet])

  // メンバー行クリック（多選択）
  const handleMemberClick = useCallback((e: React.MouseEvent, layerId: string) => {
    e.stopPropagation()
    const members = virtualSet.members
    const ids = members.map(m => m.layerId)

    if (e.shiftKey && lastClickedId) {
      const lastIndex = ids.indexOf(lastClickedId)
      const currentIndex = ids.indexOf(layerId)
      const [start, end] = lastIndex <= currentIndex
        ? [lastIndex, currentIndex]
        : [currentIndex, lastIndex]
      setSelectedIds(new Set(ids.slice(start, end + 1)))
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(layerId)) next.delete(layerId)
        else next.add(layerId)
        return next
      })
      setLastClickedId(layerId)
    } else {
      setSelectedIds(new Set([layerId]))
      setLastClickedId(layerId)
    }
    // コントロールバーのターゲットを更新（最後にクリックしたメンバー）
    setSelectedVsMember(virtualSet.id, layerId)
  }, [virtualSet.id, virtualSet.members, lastClickedId, setSelectedVsMember])

  const handleTreeNodeSelect = useCallback((layerId: string) => {
    setSelectedIds(new Set())
    setLastClickedId(layerId)
    setSelectedVsMember(virtualSet.id, layerId)
  }, [virtualSet.id, setSelectedVsMember])

  // フォルダの展開トグル（ミニツリー用）
  const toggleVsExpanded = useCallback((id: string) => {
    setVsExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // 可視性トグル
  const handleToggleVisibility = useCallback((layerId: string, visible: boolean, options?: HistoryOptions) => {
    setVirtualSetVisibilityOverride(virtualSet.id, layerId, visible, options)
  }, [virtualSet.id, setVirtualSetVisibilityOverride])

  useEffect(() => {
    if (!isSelected || virtualSet.name !== t.virtualSet.newSetName) return
    if (autoSelectedNameId.current === virtualSet.id) return
    autoSelectedNameId.current = virtualSet.id

    requestAnimationFrame(() => {
      const input = nameInputRef.current
      if (!input) return
      input.focus()
      input.select()
    })
  }, [isSelected, virtualSet.id, virtualSet.name, t.virtualSet.newSetName])

  const handleNameFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    nameEditStart.current = virtualSet.name
    nameHistoryPushed.current = false
    if (virtualSet.name === t.virtualSet.newSetName) {
      e.currentTarget.select()
    }
  }, [virtualSet.name, t.virtualSet.newSetName])

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    if (!nameHistoryPushed.current && name !== nameEditStart.current) {
      pushHistory()
      nameHistoryPushed.current = true
    }
    updateVirtualSet(virtualSet.id, { name }, { recordHistory: false })
  }, [virtualSet.id, updateVirtualSet, pushHistory])

  const handleNameBlur = useCallback(() => {
    nameEditStart.current = virtualSet.name
    nameHistoryPushed.current = false
  }, [virtualSet.name])

  // メンバーDnDハンドラ
  const handleMemberDragStart = useCallback((e: React.DragEvent, layerId: string) => {
    e.stopPropagation()
    const dragIds = selectedIds.has(layerId) ? Array.from(selectedIds) : [layerId]
    _draggingMemberInfo = { setId: virtualSet.id, layerIds: dragIds }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-member-drag', virtualSet.id)
  }, [virtualSet.id, selectedIds])

  const makeMemberDragPayload = useCallback((layerId: string): DragPayload => {
    const dragIds = selectedIds.has(layerId) ? Array.from(selectedIds) : [layerId]
    return { type: 'virtualSetMember', setId: virtualSet.id, layerIds: dragIds }
  }, [virtualSet.id, selectedIds])

  const handleMemberPointerDown = useCallback((e: React.PointerEvent, layerId: string) => {
    e.stopPropagation()
    startInternalPointerDrag(makeMemberDragPayload(layerId), e)
  }, [makeMemberDragPayload])

  const handleMemberDragEnd = useCallback(() => {
    _draggingMemberInfo = null
    setInsertLineIndex(null)
  }, [])

  const handleMemberDragOver = useCallback((e: React.DragEvent, index: number) => {
    if (!_draggingMemberInfo || _draggingMemberInfo.setId !== virtualSet.id) return
    e.preventDefault()
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const isUpperHalf = e.clientY - rect.top < rect.height / 2
    setInsertLineIndex(index)
    setInsertLinePosition(isUpperHalf ? 'above' : 'below')
  }, [virtualSet.id])

  const handleMemberDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!_draggingMemberInfo || _draggingMemberInfo.setId !== virtualSet.id) {
      setInsertLineIndex(null)
      return
    }
    if (insertLineIndex === null) {
      setInsertLineIndex(null)
      return
    }

    const draggingIds = new Set(_draggingMemberInfo.layerIds)
    const currentIds = virtualSet.members.map(m => m.layerId)
    const remaining = currentIds.filter(id => !draggingIds.has(id))
    const targetId = currentIds[insertLineIndex]
    let insertPos = targetId ? remaining.indexOf(targetId) : remaining.length
    if (insertPos === -1) insertPos = remaining.length
    const finalInsertPos = insertLinePosition === 'below' ? insertPos + 1 : insertPos

    const newOrder = [
      ...remaining.slice(0, finalInsertPos),
      ..._draggingMemberInfo.layerIds,
      ...remaining.slice(finalInsertPos),
    ]

    reorderVirtualSetMembers(virtualSet.id, newOrder)
    _draggingMemberInfo = null
    setInsertLineIndex(null)
  }, [virtualSet.id, virtualSet.members, insertLineIndex, insertLinePosition, reorderVirtualSetMembers])

  const handleListDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as HTMLElement | null
    if (!related || !(e.currentTarget as HTMLElement).contains(related)) {
      setInsertLineIndex(null)
    }
  }, [])

  const handleListDragOver = useCallback((e: React.DragEvent) => {
    if (!_draggingMemberInfo || _draggingMemberInfo.setId !== virtualSet.id) return
    e.preventDefault()
    e.stopPropagation()
  }, [virtualSet.id])

  const findMemberDropIndex = useCallback((clientX: number, clientY: number) => {
    const list = memberListRef.current
    if (!list) return null

    const element = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-vs-member-index]')
    if (!element || !list.contains(element)) return null

    const index = Number(element.dataset.vsMemberIndex)
    if (!Number.isInteger(index)) return null

    const rect = element.getBoundingClientRect()
    const position: 'above' | 'below' = clientY - rect.top < rect.height / 2 ? 'above' : 'below'
    return { index, position }
  }, [])

  const reorderMembers = useCallback((layerIds: string[], index: number, position: 'above' | 'below') => {
    const draggingIds = new Set(layerIds)
    const currentIds = virtualSet.members.map(m => m.layerId)
    const remaining = currentIds.filter(id => !draggingIds.has(id))
    const targetId = currentIds[index]
    let insertPos = targetId ? remaining.indexOf(targetId) : remaining.length
    if (insertPos === -1) insertPos = remaining.length
    const finalInsertPos = position === 'below' ? insertPos + 1 : insertPos

    reorderVirtualSetMembers(virtualSet.id, [
      ...remaining.slice(0, finalInsertPos),
      ...layerIds,
      ...remaining.slice(finalInsertPos),
    ])
  }, [virtualSet.id, virtualSet.members, reorderVirtualSetMembers])

  const { dropRef: memberListInternalDropRef } = useInternalDropTarget({
    canDrop: payload => payload.type === 'virtualSetMember' && payload.setId === virtualSet.id,
    onDragOver: (_payload, position) => {
      const target = findMemberDropIndex(position.clientX, position.clientY)
      if (!target) {
        setInsertLineIndex(null)
        return
      }
      setInsertLineIndex(target.index)
      setInsertLinePosition(target.position)
    },
    onDragLeave: () => setInsertLineIndex(null),
    onDrop: (payload, position) => {
      if (payload.type !== 'virtualSetMember' || payload.setId !== virtualSet.id) return
      const target = findMemberDropIndex(position.clientX, position.clientY)
      if (!target) {
        setInsertLineIndex(null)
        return
      }
      reorderMembers(payload.layerIds, target.index, target.position)
      setInsertLineIndex(null)
    },
  })

  const setMemberListRef = useCallback((node: HTMLDivElement | null) => {
    memberListRef.current = node
    memberListInternalDropRef(node)
  }, [memberListInternalDropRef])

  return (
    <div
      className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
      onClick={() => setSelectedVirtualSet(virtualSet.id)}
    >
      <div className={styles.header}>
        {/* 折りたたみボタン */}
        <button
          className={styles.collapseBtn}
          onClick={e => { e.stopPropagation(); setCollapsed(c => !c) }}
          title={collapsed ? '展開' : '折りたたむ'}
        >
          <Chevron open={!collapsed} />
        </button>
        {/* ドラッグハンドル */}
        <Tooltip content={"右ペインのレイヤーにドラッグして挿入位置を設定\n※ タッチ操作の場合：レイヤータブでレイヤーを選択後、↑上 / ↓下 ボタンで設定"}>
          <div
            className={styles.dragHandle}
            draggable={draggable}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onPointerDown={onPointerDown}
          >
            ⠿
          </div>
        </Tooltip>
        <input
          ref={nameInputRef}
          className={styles.name}
          value={virtualSet.name}
          onFocus={handleNameFocus}
          onChange={handleNameChange}
          onBlur={handleNameBlur}
          placeholder={t.virtualSet.newSetName}
        />
        <Tooltip content="この仮想セルを削除">
          <button
            className={styles.removeBtn}
            onClick={e => { e.stopPropagation(); removeVirtualSet(virtualSet.id) }}
          >
            ✕
          </button>
        </Tooltip>
      </div>

      {!collapsed && (
        <>
          {/* 挿入位置 */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>{t.virtualSet.insertionLabel}</div>
            {insertionText ? (
              <div className={styles.insertionInfo}>
                <span className={styles.insertionText}>{insertionText}</span>
                <button className={styles.clearBtn} onClick={e => { e.stopPropagation(); handleClearInsertion() }} title="クリア">✕</button>
              </div>
            ) : (
              <div className={styles.insertionHint}>{t.virtualSet.insertionHint}</div>
            )}
            {/* 選択中レイヤーで挿入位置を設定（DnD の代替／補助） */}
            {selectedLayer && (
              <div className={styles.insertionBySelection}>
                <span className={styles.insertionBySelectionName}>{selectedLayer.name || selectedLayer.originalName}</span>
                <button className={styles.insertionPosBtn} onClick={handleSetInsertionAbove}>↑ 上</button>
                <button className={styles.insertionPosBtn} onClick={handleSetInsertionBelow}>↓ 下</button>
              </div>
            )}
          </div>

          {/* レイヤーセクション */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>{t.virtualSet.layersLabel}</div>

            {/* メンバーリスト（縦に自由伸長） */}
            {virtualSet.members.length > 0 && (
              <div
                ref={setMemberListRef}
                className={styles.memberList}
                onDragOver={handleListDragOver}
                onDrop={handleMemberDrop}
                onDragLeave={handleListDragLeave}
              >
                {virtualSet.members.map((member, index) => {
                  const layer = selectLayerById(useAppStore.getState(), member.layerId)
                  const isRowSelected = selectedIds.has(member.layerId) || selectedVirtualLayerId === member.layerId
                  const showLineAbove = insertLineIndex === index && insertLinePosition === 'above'
                  const showLineBelow = insertLineIndex === index && insertLinePosition === 'below'
                  const isExpanded = vsExpandedIds.has(member.layerId)
                  // VS固有オーバーライド → なければレイヤー本来の状態
                  const visible = virtualSet.visibilityOverrides[member.layerId]
                    ?? (layer ? !layer.hidden && !layer.uiHidden : true)

                  return (
                    <div key={member.layerId}>
                      {showLineAbove && <div className={styles.insertionLine} />}
                      <div
                        data-vs-member-index={index}
                        className={`${styles.memberRow} ${isRowSelected ? styles.memberRowSelected : ''} ${!visible ? styles.memberRowHidden : ''}`}
                        onClick={e => handleMemberClick(e, member.layerId)}
                        draggable={memberNativeDraggable}
                        onDragStart={e => handleMemberDragStart(e, member.layerId)}
                        onDragEnd={handleMemberDragEnd}
                        onDragOver={e => handleMemberDragOver(e, index)}
                        onPointerDown={e => handleMemberPointerDown(e, member.layerId)}
                      >
                        <div className={styles.memberDragHandle}>⠿</div>

                        {/* フォルダなら展開ボタン */}
                        {layer?.isFolder ? (
                          <button
                            className={styles.memberExpandBtn}
                            onClick={e => { e.stopPropagation(); toggleVsExpanded(member.layerId) }}
                            title={isExpanded ? '折りたたむ' : '展開'}
                          >
                            <Chevron open={isExpanded} />
                          </button>
                        ) : (
                          <div className={styles.memberExpandPlaceholder} />
                        )}

                        {/* 可視性トグル */}
                        <button
                          className={styles.memberVisibilityBtn}
                          onMouseDown={e => {
                            e.stopPropagation()
                            e.preventDefault()
                            vsVisibilityDrag.active = true
                            vsVisibilityDrag.targetVisible = !visible
                            handleToggleVisibility(member.layerId, !visible)
                          }}
                          onMouseEnter={e => {
                            if (!vsVisibilityDrag.active) return
                            e.stopPropagation()
                            if (visible !== vsVisibilityDrag.targetVisible) {
                              handleToggleVisibility(member.layerId, vsVisibilityDrag.targetVisible, { recordHistory: false })
                            }
                          }}
                          title={visible ? '非表示にする' : '表示にする'}
                        >
                          {visible ? '👁' : ''}
                        </button>

                        <span className={styles.memberName}>{layer?.name ?? member.layerId}</span>

                        <button
                          className={styles.memberRemove}
                          onClick={e => {
                            e.stopPropagation()
                            removeVirtualSetMember(virtualSet.id, member.layerId)
                            setSelectedIds(prev => {
                              const next = new Set(prev)
                              next.delete(member.layerId)
                              return next
                            })
                          }}
                        >
                          ✕
                        </button>
                      </div>

                      {/* フォルダ展開時：子ノードをミニツリー表示 */}
                      {layer?.isFolder && isExpanded && layer.children.map(child => (
                        <VsMemberNode
                          key={child.id}
                          layer={child}
                          vsId={virtualSet.id}
                          overrides={virtualSet.visibilityOverrides}
                          expandedIds={vsExpandedIds}
                          selectedLayerId={selectedVirtualLayerId}
                          onToggleExpand={toggleVsExpanded}
                          onToggleVisibility={handleToggleVisibility}
                          onSelectLayer={handleTreeNodeSelect}
                          depth={1}
                        />
                      ))}

                      {showLineBelow && <div className={styles.insertionLine} />}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 追加用ドロップゾーン（常に表示） */}
            <div
              ref={memberDropRef}
              className={`${styles.dropZone} ${memberIsOver ? styles.dropZoneOver : ''}`}
              {...memberDropHandlers}
            >
              {virtualSet.members.length === 0
                ? t.virtualSet.layersPlaceholder
                : '＋ レイヤーをドロップして追加'}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
