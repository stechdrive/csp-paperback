import { useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n'
import { selectLayerById } from '../store/selectors'
import { useDragSource, useDropZone, type DragPayload } from '../hooks/useDragDrop'
import type { CspLayer, VirtualSet } from '../types'
import styles from './VirtualSetItem.module.css'

interface VirtualSetItemProps {
  virtualSet: VirtualSet
}

const BLEND_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: 'normal', label: '通常' },
  { value: 'multiply', label: '乗算' },
  { value: 'screen', label: 'スクリーン' },
  { value: 'overlay', label: 'オーバーレイ' },
  { value: 'darken', label: '暗く' },
  { value: 'lighten', label: '明るく' },
  { value: 'color-dodge', label: '覆い焼き' },
  { value: 'color-burn', label: '焼き込み' },
  { value: 'hard-light', label: 'ハードライト' },
  { value: 'soft-light', label: 'ソフトライト' },
  { value: 'difference', label: '差の絶対値' },
  { value: 'exclusion', label: '除外' },
]

/** CspLayerのblendMode値（スペース区切り）をUIラベ���に変換 */
function layerBlendModeLabel(blendMode: string | undefined): string {
  if (!blendMode) return '通常'
  const map: Record<string, string> = {
    'normal': '通常', 'multiply': '乗算', 'screen': 'スクリーン',
    'overlay': 'オーバーレイ', 'darken': '暗く', 'lighten': '明るく',
    'color dodge': '覆い焼き', 'color burn': '焼き込み',
    'hard light': 'ハードライト', 'soft light': 'ソフトライト',
    'difference': '差の絶対値', 'exclusion': '除外',
    'pass through': '通過', 'hue': '色相', 'saturation': '彩度',
    'color': 'カラー', 'luminosity': '輝度',
  }
  return map[blendMode] ?? blendMode
}

// モジュールレベルのDnD状態
let _draggingMemberInfo: { setId: string; layerIds: string[] } | null = null

// =========================================================
// ミニツリー：フォルダ展開時の子ノード表示
// =========================================================
interface VsMemberNodeProps {
  layer: CspLayer
  vsId: string
  overrides: Record<string, boolean>
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
  onToggleVisibility: (layerId: string, visible: boolean) => void
  depth: number
}

function VsMemberNode({
  layer,
  vsId: _vsId,
  overrides,
  expandedIds,
  onToggleExpand,
  onToggleVisibility,
  depth,
}: VsMemberNodeProps) {
  // VS固有オーバーライドがあればそれを使い、なければレイヤー本来の状態を使う
  const visible = overrides[layer.id] ?? (!layer.hidden && !layer.uiHidden)
  const isExpanded = expandedIds.has(layer.id)

  return (
    <>
      <div
        className={`${styles.vsTreeNode} ${!visible ? styles.vsTreeNodeHidden : ''}`}
        style={{ paddingLeft: `${4 + depth * 14}px` }}
      >
        {layer.isFolder ? (
          <button
            className={styles.vsExpandBtn}
            onClick={e => { e.stopPropagation(); onToggleExpand(layer.id) }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <div className={styles.vsExpandPlaceholder} />
        )}
        <button
          className={`${styles.vsVisibilityBtn} ${!visible ? styles.vsVisibilityHidden : ''}`}
          onClick={e => { e.stopPropagation(); onToggleVisibility(layer.id, !visible) }}
          title={visible ? '非表示にする' : '表示にする'}
        >
          {visible ? '👁' : '🚫'}
        </button>
        <span className={styles.vsLayerName} title={layer.originalName}>
          {layer.name || layer.originalName}
        </span>
      </div>
      {layer.isFolder && isExpanded && layer.children.map(child => (
        <VsMemberNode
          key={child.id}
          layer={child}
          vsId={_vsId}
          overrides={overrides}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
          onToggleVisibility={onToggleVisibility}
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
  const setVirtualSetMemberBlendMode = useAppStore(s => s.setVirtualSetMemberBlendMode)
  const setVirtualSetVisibilityOverride = useAppStore(s => s.setVirtualSetVisibilityOverride)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const setSelectedVirtualSet = useAppStore(s => s.setSelectedVirtualSet)
  const isSelected = selectedVirtualSetId === virtualSet.id
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
  }, [virtualSet.members, lastClickedId])

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
  const handleToggleVisibility = useCallback((layerId: string, visible: boolean) => {
    setVirtualSetVisibilityOverride(virtualSet.id, layerId, visible)
  }, [virtualSet.id, setVirtualSetVisibilityOverride])

  // メンバーDnDハンドラ
  const handleMemberDragStart = useCallback((e: React.DragEvent, layerId: string) => {
    e.stopPropagation()
    const dragIds = selectedIds.has(layerId) ? Array.from(selectedIds) : [layerId]
    _draggingMemberInfo = { setId: virtualSet.id, layerIds: dragIds }
    e.dataTransfer.effectAllowed = 'move'
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
          {collapsed ? '▶' : '▼'}
        </button>
        {/* ドラッグハンドル */}
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
          </div>

          {/* レイヤーセクション */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>{t.virtualSet.layersLabel}</div>

            {/* メンバーリスト（縦に自由伸長） */}
            {virtualSet.members.length > 0 && (
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
                  const isExpanded = vsExpandedIds.has(member.layerId)
                  // VS固有オーバーライド → なければレイヤー本来の状態
                  const visible = virtualSet.visibilityOverrides[member.layerId]
                    ?? (layer ? !layer.hidden && !layer.uiHidden : true)

                  return (
                    <div key={member.layerId}>
                      {showLineAbove && <div className={styles.insertionLine} />}
                      <div
                        className={`${styles.memberRow} ${isRowSelected ? styles.memberRowSelected : ''} ${!visible ? styles.memberRowHidden : ''}`}
                        onClick={e => handleMemberClick(e, member.layerId)}
                        draggable
                        onDragStart={e => handleMemberDragStart(e, member.layerId)}
                        onDragEnd={handleMemberDragEnd}
                        onDragOver={e => handleMemberDragOver(e, index)}
                      >
                        <div className={styles.memberDragHandle}>⠿</div>

                        {/* フォルダなら展開ボタン */}
                        {layer?.isFolder ? (
                          <button
                            className={styles.memberExpandBtn}
                            onClick={e => { e.stopPropagation(); toggleVsExpanded(member.layerId) }}
                            title={isExpanded ? '折りたたむ' : '展開'}
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        ) : (
                          <div className={styles.memberExpandPlaceholder} />
                        )}

                        {/* 可視性トグル */}
                        <button
                          className={`${styles.memberVisibilityBtn} ${!visible ? styles.memberVisibilityHidden : ''}`}
                          onClick={e => { e.stopPropagation(); handleToggleVisibility(member.layerId, !visible) }}
                          title={visible ? '非表示にする' : '表示にする'}
                        >
                          {visible ? '👁' : '🚫'}
                        </button>

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
                          <option value="">
                            {layerBlendModeLabel(layer?.blendMode)}
                          </option>
                          {BLEND_MODE_OPTIONS.map(bm => (
                            <option key={bm.value} value={bm.value}>
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

                      {/* フォルダ展開時：子ノードをミニツリー表示 */}
                      {layer?.isFolder && isExpanded && layer.children.map(child => (
                        <VsMemberNode
                          key={child.id}
                          layer={child}
                          vsId={virtualSet.id}
                          overrides={virtualSet.visibilityOverrides}
                          expandedIds={vsExpandedIds}
                          onToggleExpand={toggleVsExpanded}
                          onToggleVisibility={handleToggleVisibility}
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
