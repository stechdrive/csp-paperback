import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { selectLayerById } from '../store/selectors'
import { useDragSource } from '../hooks/useDragDrop'
import { Tooltip } from './Tooltip'
import { LayerExpandIcon } from './LayerTreeRow'
import { VirtualSetTree } from './VirtualSetTree'
import type { VirtualSet } from '../types'
import styles from './VirtualSetItem.module.css'
import { virtualOutputId } from '../utils/output-identity'
import { PaneMenu } from './PaneMenu'
import { useVirtualSetPsdExport } from '../hooks/useVirtualSetPsdExport'

export function VirtualSetItem({ virtualSet, onPreviewOutput }: {
  virtualSet: VirtualSet
  onPreviewOutput?: () => void
}) {
  const update = useAppStore(s => s.updateVirtualSet)
  const remove = useAppStore(s => s.removeVirtualSet)
  const pushHistory = useAppStore(s => s.pushHistory)
  const selectedId = useAppStore(s => s.selectedVirtualSetId)
  const selectSet = useAppStore(s => s.setSelectedVirtualSet)
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const { t } = useLocale()
  const { isExporting, exportPsd } = useVirtualSetPsdExport()
  const [collapsed, setCollapsed] = useState(false)
  const nameEditStart = useRef(virtualSet.name), nameHistoryPushed = useRef(false)
  const nameInput = useRef<HTMLInputElement>(null), autoSelected = useRef<string | null>(null)
  const drag = useDragSource({ type: 'virtualSet', virtualSetId: virtualSet.id })
  const state = useAppStore.getState()
  const insertionLayer = virtualSet.insertionLayerId ? selectLayerById(state, virtualSet.insertionLayerId) : null
  const selectedLayer = selectedLayerId ? selectLayerById(state, selectedLayerId) : null
  const insertionText = insertionLayer
    ? `${insertionLayer.name} の${virtualSet.insertionPosition === 'above' ? '上' : '下'}` : null

  useEffect(() => {
    if (selectedId !== virtualSet.id || virtualSet.name !== t.virtualSet.newSetName || autoSelected.current === virtualSet.id) return
    const frame = requestAnimationFrame(() => {
      autoSelected.current = virtualSet.id
      nameInput.current?.focus(); nameInput.current?.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [selectedId, virtualSet.id, virtualSet.name, t.virtualSet.newSetName])

  return <div className={`${styles.item} ${selectedId === virtualSet.id ? styles.itemSelected : ''}`}
    data-virtual-set-card={virtualSet.id} onClick={() => selectSet(virtualSet.id)}>
    <div className={styles.header}>
      <Tooltip content={collapsed ? '展開' : '折りたたむ'}><button aria-label={collapsed ? '展開' : '折りたたむ'}
        className={styles.collapseBtn} onClick={event => { event.stopPropagation(); setCollapsed(!collapsed) }}>
        <LayerExpandIcon expanded={!collapsed} />
      </button></Tooltip>
      <Tooltip content="右ペインへドラッグして仮想セルの挿入位置を設定">
        <div className={styles.dragHandle} data-vs-placement-handle draggable={drag.draggable}
          onDragStart={drag.onDragStart} onDragEnd={drag.onDragEnd} onPointerDown={drag.onPointerDown}>⠿</div>
      </Tooltip>
      <input ref={nameInput} className={styles.name} value={virtualSet.name}
        aria-label={t.virtualSet.newSetName} placeholder={t.virtualSet.newSetName}
        onFocus={event => {
          nameEditStart.current = virtualSet.name; nameHistoryPushed.current = false
          if (virtualSet.name === t.virtualSet.newSetName) event.currentTarget.select()
        }} onChange={event => {
          const name = event.target.value
          if (!nameHistoryPushed.current && name !== nameEditStart.current) { pushHistory(); nameHistoryPushed.current = true }
          update(virtualSet.id, { name }, { recordHistory: false })
        }} onBlur={() => { nameEditStart.current = virtualSet.name; nameHistoryPushed.current = false }} />
      <Tooltip content="この仮想セルを削除"><button className={styles.removeBtn} aria-label="この仮想セルを削除"
        onClick={event => { event.stopPropagation(); remove(virtualSet.id) }}>✕</button></Tooltip>
      <Tooltip content="書き出し画像に表示"><button className={styles.collapseBtn} aria-label="仮想セルをプレビュー"
        onClick={event => { event.stopPropagation(); useAppStore.getState().selectOutputFile(virtualOutputId(virtualSet.id)); onPreviewOutput?.() }}>◧</button></Tooltip>
      <PaneMenu label={`${virtualSet.name}のメニュー`}>
        <button role="menuitem" disabled={isExporting || !virtualSet.members.length} onClick={() => void exportPsd(virtualSet.id)}>PSDとして書き出す</button>
      </PaneMenu>
    </div>
    {!collapsed && <>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>{t.virtualSet.insertionLabel}</div>
        {insertionText ? <div className={styles.insertionInfo}>
          <span className={styles.insertionText}>{insertionText}</span>
          <Tooltip content="クリア"><button aria-label="クリア" className={styles.clearBtn}
            onClick={event => { event.stopPropagation(); update(virtualSet.id, { insertionLayerId: null, insertionPosition: 'above' }) }}>✕</button></Tooltip>
        </div> : <div className={styles.insertionHint}>{t.virtualSet.insertionHint}</div>}
        {selectedLayer && <div className={styles.insertionBySelection}>
          <span className={styles.insertionBySelectionName}>{selectedLayer.name || selectedLayer.originalName}</span>
          <button className={styles.insertionPosBtn} onClick={event => {
            event.stopPropagation(); update(virtualSet.id, { insertionLayerId: selectedLayerId, insertionPosition: 'above' })
          }}>↑ 上</button>
          <button className={styles.insertionPosBtn} onClick={event => {
            event.stopPropagation(); update(virtualSet.id, { insertionLayerId: selectedLayerId, insertionPosition: 'below' })
          }}>↓ 下</button>
        </div>}
      </div>
      <div className={styles.treeSection}>
        <VirtualSetTree virtualSet={virtualSet} />
      </div>
    </>}
  </div>
}
