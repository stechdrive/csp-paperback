import { useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n'
import { selectLayerById } from '../store/selectors'
import { useDragSource, useDropZone, type DragPayload } from '../hooks/useDragDrop'
import type { VirtualSet } from '../types'
import styles from './VirtualSetItem.module.css'

interface VirtualSetItemProps {
  virtualSet: VirtualSet
}

const BLEND_MODES: { value: string | null; label: string }[] = [
  { value: null, label: 'レイヤー設定' },
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
]

// モジュールレベルのDnD状態
let _draggingMemberInfo: { setId: string; layerIds: string[] } | null = null

export function VirtualSetItem({ virtualSet }: VirtualSetItemProps) {
  const updateVirtualSet = useAppStore(s => s.updateVirtualSet)
  const removeVirtualSet = useAppStore(s => s.removeVirtualSet)
  const addVirtualSetMember = useAppStore(s => s.addVirtualSetMember)
  const removeVirtualSetMember = useAppStore(s => s.removeVirtualSetMember)
  const reorderVirtualSetMembers = useAppStore(s => s.reorderVirtualSetMembers)
  const setVirtualSetMemberBlendMode = useAppStore(s => s.setVirtualSetMemberBlendMode)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const setSelectedVirtualSet = useAppStore(s => s.setSelectedVirtualSet)
  const isSelected = selectedVirtualSetId === virtualSet.id
  const { t } = useLocale()

  // 多選択状態
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)

  // メンバー行ドラッグ挿入ライン
  const [insertLineIndex, setInsertLineIndex] = useState<number | null>(null)
  const [insertLinePosition, setInsertLinePosition] = useState<'above' | 'below'>('below')

  // 仮想セット自体をドラッグして右ペインに挿入位置を設定するためのドラッグソース
  const { draggable, onDragStart, onDragEnd } = useDragSource({
    type: 'virtualSet',
    virtualSetId: virtualSet.id,
  })

  const onMemberDrop = useCallback((payload: DragPayload) => {
    if (payload.type === 'layer') {
      addVirtualSetMember(virtualSet.id, payload.layerId)
    }
  }, [virtualSet.id, addVirtualSetMember])

  const { dropHandlers: memberDropHandlers, isOver: memberIsOver } = useDropZone(onMemberDrop)

  // 挿入位置の表示テキストを生成
  const state = useAppStore.getState()
  const insertionLayer = virtualSet.insertionLayerId
    ? selectLayerById(state, virtualSet.insertionLayerId)
    : null
  const insertionText = insertionLayer
    ? `${insertionLayer.name} の${virtualSet.insertionPosition === 'above' ? '上' : '下'}`
    : null

  const handleClearInsertion = useCallback(() => {
    updateVirtualSet(virtualSet.id, { insertionLayerId: null, insertionPosition: 'above' })
  }, [virtualSet.id, updateVirtualSet])

  // メンバー行クリック（多選択）
  const handleMemberClick = useCallback((e: React.MouseEvent, layerId: string) => {
    e.stopPropagation()
    const members = virtualSet.members
    const ids = members.map(m => m.layerId)

    if (e.shiftKey && lastClickedId) {
      // Shift+クリック: 範囲選択
      const lastIndex = ids.indexOf(lastClickedId)
      const currentIndex = ids.indexOf(layerId)
      const [start, end] = lastIndex <= currentIndex
        ? [lastIndex, currentIndex]
        : [currentIndex, lastIndex]
      const rangeIds = ids.slice(start, end + 1)
      setSelectedIds(new Set(rangeIds))
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+クリック: 個別トグル
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(layerId)) {
          next.delete(layerId)
        } else {
          next.add(layerId)
        }
        return next
      })
      setLastClickedId(layerId)
    } else {
      // 通常クリック: 単独選択
      setSelectedIds(new Set([layerId]))
      setLastClickedId(layerId)
    }
  }, [virtualSet.members, lastClickedId])

  // メンバーDnDハンドラ
  const handleMemberDragStart = useCallback((e: React.DragEvent, layerId: string) => {
    e.stopPropagation()
    const dragIds = selectedIds.has(layerId)
      ? Array.from(selectedIds)
      : [layerId]
    _draggingMemberInfo = { setId: virtualSet.id, layerIds: dragIds }
    e.dataTransfer.effectAllowed = 'move'
    // ダミーデータ（同一コンポーネント内DnD用）
    e.dataTransfer.setData('application/x-member-drag', virtualSet.id)
  }, [virtualSet.id, selectedIds])

  const handleMemberDragEnd = useCallback((_e: React.DragEvent) => {
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

    // 挿入先インデックスを計算（ドラッグ中のアイテムを除いた配列での位置）
    const remaining = currentIds.filter(id => !draggingIds.has(id))

    // insertLineIndex はドラッグ元を含む元の配列のインデックス
    // above: そのインデックスの前に挿入、below: そのインデックスの後に挿入
    const targetId = currentIds[insertLineIndex]
    let insertPos = targetId
      ? remaining.indexOf(targetId)
      : remaining.length

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
    // リスト外に出た場合はラインを消す
    const related = e.relatedTarget as HTMLElement | null
    if (!related || !(e.currentTarget as HTMLElement).contains(related)) {
      setInsertLineIndex(null)
    }
  }, [])

  const handleListDragOver = useCallback((e: React.DragEvent) => {
    // メンバー行以外のエリア（リストの末尾）へのドラッグを処理
    if (!_draggingMemberInfo || _draggingMemberInfo.setId !== virtualSet.id) return
    e.preventDefault()
    e.stopPropagation()
  }, [virtualSet.id])

  return (
    <div
      className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
      onClick={() => setSelectedVirtualSet(virtualSet.id)}
    >
      <div className={styles.header}>
        {/* ドラッグハンドル：右ペインにドラッグして挿入位置を設定 */}
        <div
          className={styles.dragHandle}
          draggable={draggable}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          title={t.virtualSet.dragHandleTitle}
        >
          ⠿
        </div>
        <input
          className={styles.name}
          value={virtualSet.name}
          onChange={e => updateVirtualSet(virtualSet.id, { name: e.target.value })}
          placeholder={t.virtualSet.newSetName}
        />
        <button
          className={styles.removeBtn}
          onClick={e => { e.stopPropagation(); removeVirtualSet(virtualSet.id) }}
          title={t.virtualSet.remove}
        >
          ✕
        </button>
      </div>

      {/* 挿入位置：右ペインへのドラッグで設定。現在の設定を表示するだけ */}
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
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>{t.virtualSet.membersLabel}</div>
        <div
          className={`${styles.dropZone} ${memberIsOver ? styles.dropZoneOver : ''}`}
          {...memberDropHandlers}
        >
          {virtualSet.members.length > 0 ? (
            <div
              className={styles.memberList}
              onDragOver={handleListDragOver}
              onDrop={handleMemberDrop}
              onDragLeave={handleListDragLeave}
            >
              {virtualSet.members.map((member, index) => {
                const layer = selectLayerById(useAppStore.getState(), member.layerId)
                const isRowSelected = selectedIds.has(member.layerId)
                const showLineAbove = insertLineIndex === index && insertLinePosition === 'above'
                const showLineBelow = insertLineIndex === index && insertLinePosition === 'below'
                return (
                  <div key={member.layerId}>
                    {showLineAbove && <div className={styles.insertionLine} />}
                    <div
                      className={`${styles.memberRow} ${isRowSelected ? styles.memberRowSelected : ''}`}
                      onClick={e => handleMemberClick(e, member.layerId)}
                      draggable
                      onDragStart={e => handleMemberDragStart(e, member.layerId)}
                      onDragEnd={handleMemberDragEnd}
                      onDragOver={e => handleMemberDragOver(e, index)}
                    >
                      <div className={styles.memberDragHandle}>⠿</div>
                      <span className={styles.memberName}>{layer?.name ?? member.layerId}</span>
                      <select
                        className={styles.blendModeSelect}
                        value={member.blendMode ?? ''}
                        onChange={e => {
                          e.stopPropagation()
                          const val = e.target.value === '' ? null : e.target.value
                          setVirtualSetMemberBlendMode(virtualSet.id, member.layerId, val)
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        {BLEND_MODES.map(bm => (
                          <option key={bm.value ?? '__null__'} value={bm.value ?? ''}>
                            {bm.label}
                          </option>
                        ))}
                      </select>
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
                    {showLineBelow && <div className={styles.insertionLine} />}
                  </div>
                )
              })}
            </div>
          ) : (
            t.virtualSet.membersPlaceholder
          )}
        </div>
      </div>
    </div>
  )
}
