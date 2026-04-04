import { useCallback } from 'react'
import { useAppStore } from '../store'
import { selectLayerById } from '../store/selectors'
import { useDropZone, type DragPayload } from '../hooks/useDragDrop'
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

  // 挿入位置のドロップ
  const onInsertionDrop = useCallback((payload: DragPayload) => {
    if (payload.type === 'layer') {
      updateVirtualSet(virtualSet.id, { insertionLayerId: payload.layerId })
    }
  }, [virtualSet.id, updateVirtualSet])

  // メンバーのドロップ
  const onMemberDrop = useCallback((payload: DragPayload) => {
    if (payload.type === 'layer') {
      addVirtualSetMember(virtualSet.id, payload.layerId)
    }
  }, [virtualSet.id, addVirtualSetMember])

  const { dropHandlers: insertionDropHandlers, isOver: insertionIsOver } = useDropZone(onInsertionDrop)
  const { dropHandlers: memberDropHandlers, isOver: memberIsOver } = useDropZone(onMemberDrop)

  const state = useAppStore.getState()
  const insertionLayer = virtualSet.insertionLayerId
    ? selectLayerById(state, virtualSet.insertionLayerId)
    : null

  return (
    <div className={styles.item}>
      <div className={styles.header}>
        <input
          className={styles.name}
          value={virtualSet.name}
          onChange={e => updateVirtualSet(virtualSet.id, { name: e.target.value })}
          placeholder="セット名"
        />
        <button
          className={styles.removeBtn}
          onClick={() => removeVirtualSet(virtualSet.id)}
          title="削除"
        >
          ✕
        </button>
      </div>

      {/* 差し込み階層位置 */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>差し込み位置</div>
        <div
          className={`${styles.dropZone} ${insertionIsOver ? styles.dropZoneOver : ''}`}
          {...insertionDropHandlers}
        >
          {insertionLayer ? (
            <span className={styles.insertionLayer}>{insertionLayer.name}</span>
          ) : (
            'レイヤーをドロップ'
          )}
        </div>
      </div>

      {/* メンバー */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>メンバー</div>
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
                      onClick={() => removeVirtualSetMember(virtualSet.id, id)}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            'レイヤーをドロップ'
          )}
        </div>
      </div>
    </div>
  )
}
