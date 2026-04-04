import { useCallback } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n'
import { selectLayerById } from '../store/selectors'
import { useDragSource, useDropZone, type DragPayload } from '../hooks/useDragDrop'
import type { VirtualSet } from '../types'
import styles from './VirtualSetItem.module.css'

interface VirtualSetItemProps {
  virtualSet: VirtualSet
}

export function VirtualSetItem({ virtualSet }: VirtualSetItemProps) {
  const updateVirtualSet = useAppStore(s => s.updateVirtualSet)
  const removeVirtualSet = useAppStore(s => s.removeVirtualSet)
  const addVirtualSetMember = useAppStore(s => s.addVirtualSetMember)
  const removeVirtualSetMember = useAppStore(s => s.removeVirtualSetMember)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const setSelectedVirtualSet = useAppStore(s => s.setSelectedVirtualSet)
  const isSelected = selectedVirtualSetId === virtualSet.id
  const { t } = useLocale()

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
          {virtualSet.memberLayerIds.length > 0 ? (
            <div className={styles.memberList}>
              {virtualSet.memberLayerIds.map(id => {
                const layer = selectLayerById(useAppStore.getState(), id)
                return (
                  <div key={id} className={styles.memberItem}>
                    <span className={styles.memberName}>{layer?.name ?? id}</span>
                    <button
                      className={styles.memberRemove}
                      onClick={e => { e.stopPropagation(); removeVirtualSetMember(virtualSet.id, id) }}
                    >
                      ✕
                    </button>
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
