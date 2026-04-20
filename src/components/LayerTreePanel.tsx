import { useCallback, useMemo, useRef } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { selectLayerTreeWithVisibility, selectLayerById } from '../store/selectors'
import { LayerTreeNode } from './LayerTreeNode'
import { BlendOpacityBar } from './BlendOpacityBar'
import { Tooltip } from './Tooltip'
import type { BlendMode } from '../types'
import {
  collectShiftNavigationExpandableFolders,
  collectShiftNavigationExpandedPath,
  flattenVisible,
  findLayerById,
  mergeExpandedFolders,
  subtractCollapsedFolders,
} from '../utils/layerNavigation'
import styles from './LayerTreePanel.module.css'

export function LayerTreePanel() {
  const tree = useAppStore(selectLayerTreeWithVisibility)
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const expandedFolders = useAppStore(s => s.expandedFolders)
  const userCollapsedFolders = useAppStore(s => s.userCollapsedFolders)
  const visibilityOverrides = useAppStore(s => s.visibilityOverrides)
  const virtualSets = useAppStore(s => s.virtualSets)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const { t } = useLocale()

  const manualAnimFolderIds = useAppStore(s => s.manualAnimFolderIds)
  const singleMarks = useAppStore(s => s.singleMarks)
  const selectLayer = useAppStore(s => s.selectLayer)
  const selectAnimCell = useAppStore(s => s.selectAnimCell)
  const setFocusedAnimFolder = useAppStore(s => s.setFocusedAnimFolder)
  const toggleLayerVisibility = useAppStore(s => s.toggleLayerVisibility)
  const setFolderExpanded = useAppStore(s => s.setFolderExpanded)
  const setFolderExpandedRecursive = useAppStore(s => s.setFolderExpandedRecursive)
  const toggleSingleMark = useAppStore(s => s.toggleSingleMark)
  const toggleManualAnimFolder = useAppStore(s => s.toggleManualAnimFolder)
  const resetVisibility = useAppStore(s => s.resetVisibility)
  const setLayerBlendMode = useAppStore(s => s.setLayerBlendMode)
  const setLayerOpacity = useAppStore(s => s.setLayerOpacity)
  const setSelectedVirtualSet = useAppStore(s => s.setSelectedVirtualSet)

  const selectedLayer = useAppStore(s => selectedLayerId ? selectLayerById(s, selectedLayerId) : null)

  const treeRef = useRef<HTMLDivElement>(null)

  const shiftExpandableFolders = useMemo(
    () => collectShiftNavigationExpandableFolders(tree, manualAnimFolderIds, virtualSets),
    [tree, manualAnimFolderIds, virtualSets],
  )
  const navigationExpandedFolders = useMemo(
    () => subtractCollapsedFolders(
      mergeExpandedFolders(expandedFolders, shiftExpandableFolders),
      userCollapsedFolders,
    ),
    [expandedFolders, shiftExpandableFolders, userCollapsedFolders],
  )
  const selectedShiftExpandedFolders = useMemo(
    () => selectedVirtualSetId
      ? collectShiftNavigationExpandedPath(
        tree,
        virtualSets.find(vs => vs.id === selectedVirtualSetId)?.insertionLayerId ?? '',
        expandedFolders,
        shiftExpandableFolders,
      )
      : selectedLayerId
      ? collectShiftNavigationExpandedPath(
        tree,
        selectedLayerId,
        expandedFolders,
        shiftExpandableFolders,
      )
      : new Set<string>(),
    [tree, selectedLayerId, selectedVirtualSetId, virtualSets, expandedFolders, shiftExpandableFolders],
  )
  const visibleExpandedFolders = useMemo(
    () => subtractCollapsedFolders(
      mergeExpandedFolders(expandedFolders, selectedShiftExpandedFolders),
      userCollapsedFolders,
    ),
    [expandedFolders, selectedShiftExpandedFolders, userCollapsedFolders],
  )
  /**
   * 現在「仮展開のみで開いている」フォルダ集合。
   * 視覚的には開いているが、ユーザーの永続状態では閉じている（Shift巡回由来）。
   * LayerTreeNode でチェブロンを薄く表示するために使う。
   */
  const transientExpandedFolders = useMemo(() => {
    if (selectedShiftExpandedFolders.size === 0) return selectedShiftExpandedFolders
    const result = new Set<string>()
    for (const id of selectedShiftExpandedFolders) {
      if (!expandedFolders.has(id) && !userCollapsedFolders.has(id)) result.add(id)
    }
    return result
  }, [selectedShiftExpandedFolders, expandedFolders, userCollapsedFolders])

  const scrollLayerIntoView = useCallback((layerId: string) => {
    requestAnimationFrame(() => {
      const el = treeRef.current?.querySelector(`[data-layer-id="${layerId}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    })
  }, [])

  const scrollVirtualSetIntoView = useCallback((virtualSetId: string) => {
    requestAnimationFrame(() => {
      const el = treeRef.current?.querySelector(`[data-virtual-set-id="${virtualSetId}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    })
  }, [])

  /** Shift+スクロールでレイヤーを上下切り替え（プレビュー連動） */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.shiftKey || tree.length === 0) return
    e.preventDefault()

    const entries = flattenVisible(tree, navigationExpandedFolders, manualAnimFolderIds, virtualSets)
    if (entries.length === 0) return

    const currentIdx = selectedVirtualSetId
      ? entries.findIndex(e => e.kind === 'virtualSet' && e.id === selectedVirtualSetId)
      : selectedLayerId
        ? entries.findIndex(e => e.kind === 'layer' && e.id === selectedLayerId)
        : -1
    const direction = e.deltaY > 0 ? 1 : -1
    let nextIdx: number
    if (currentIdx < 0) {
      nextIdx = direction > 0 ? 0 : entries.length - 1
    } else {
      nextIdx = Math.max(0, Math.min(entries.length - 1, currentIdx + direction))
    }

    const entry = entries[nextIdx]
    const alreadySelected = entry.kind === 'virtualSet'
      ? entry.id === selectedVirtualSetId
      : entry.id === selectedLayerId && selectedVirtualSetId === null

    if (!alreadySelected) {
      // handleRowClick と同じ選択ロジックでプレビューを連動
      if (entry.kind === 'virtualSet' && entry.virtualSet) {
        setSelectedVirtualSet(entry.virtualSet.id)
        scrollVirtualSetIntoView(entry.virtualSet.id)
      } else if (entry.isCell && entry.animParentId) {
        const { layerTree } = useAppStore.getState()
        const animFolder = findLayerById(layerTree, entry.animParentId)
        if (animFolder) {
          const idx = animFolder.children.findIndex(c => c.id === entry.id)
          if (idx >= 0) {
            selectAnimCell(entry.animParentId, idx)
            setFocusedAnimFolder(entry.animParentId)
          }
        }
        selectLayer(entry.id)
      } else if (entry.layer.isAnimationFolder) {
        selectLayer(entry.id)
        setFocusedAnimFolder(entry.id)
      } else if (entry.layer.autoMarked || singleMarks.has(entry.id)) {
        selectLayer(entry.id)
        setFocusedAnimFolder(null)
      } else {
        setSelectedVirtualSet(null)
        selectLayer(entry.id)
      }
      // 選択先が見えるようにスクロール
      if (entry.kind === 'layer') {
        scrollLayerIntoView(entry.id)
      }
    }
  }, [
    tree,
    navigationExpandedFolders,
    manualAnimFolderIds,
    virtualSets,
    singleMarks,
    selectedLayerId,
    selectedVirtualSetId,
    selectLayer,
    selectAnimCell,
    setFocusedAnimFolder,
    setSelectedVirtualSet,
    scrollLayerIntoView,
    scrollVirtualSetIntoView,
  ])

  const handleBlendModeChange = useCallback((value: string) => {
    if (!selectedLayerId) return
    setLayerBlendMode(selectedLayerId, value as BlendMode)
  }, [selectedLayerId, setLayerBlendMode])

  const handleOpacityChange = useCallback((value: number) => {
    if (!selectedLayerId) return
    setLayerOpacity(selectedLayerId, value)
  }, [selectedLayerId, setLayerOpacity])

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{t.layerTree.title}</span>
        <Tooltip content="すべての 👁 表示/非表示を元に戻す（出力には影響しません）">
          <button className={styles.resetBtn} onClick={resetVisibility}>
            {t.layerTree.resetVisibility}
          </button>
        </Tooltip>
      </div>

      {/* 選択レイヤーの合成モード・不透明度コントロール */}
      <BlendOpacityBar
        blendMode={selectedLayer?.blendMode ?? 'normal'}
        opacity={selectedLayer?.opacity ?? 100}
        disabled={!selectedLayer}
        showPassThrough={selectedLayer?.isFolder ?? true}
        onBlendModeChange={handleBlendModeChange}
        onOpacityChange={handleOpacityChange}
      />

      <div className={styles.tree} ref={treeRef} onWheel={handleWheel}>
        {tree.length === 0 ? (
          <div className={styles.empty}>
            {t.layerTree.empty.split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </div>
        ) : (
          tree.map(layer => (
            <LayerTreeNode
              key={layer.id}
              layer={layer}
              selectedLayerId={selectedLayerId}
              onSelect={selectLayer}
              onToggleVisibility={toggleLayerVisibility}
              onSetExpanded={setFolderExpanded}
              onSetExpandedRecursive={setFolderExpandedRecursive}
              onToggleMark={toggleSingleMark}
              onToggleAnimFolder={toggleManualAnimFolder}
              expandedFolders={visibleExpandedFolders}
              transientExpandedFolders={transientExpandedFolders}
              visibilityOverrides={visibilityOverrides}
            />
          ))
        )}
      </div>

      <Tooltip content={"レイヤー一覧を上下にたどって、プレビュー対象をすばやく切り替えます\n閉じたアニメフォルダや _ フォルダも一時的に開いて移動します"}>
        <div className={styles.footerHint}>
          Shift+スクロールでプレビュー切替
        </div>
      </Tooltip>
    </div>
  )
}
