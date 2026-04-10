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
} from '../utils/layerNavigation'
import styles from './LayerTreePanel.module.css'

export function LayerTreePanel() {
  const tree = useAppStore(selectLayerTreeWithVisibility)
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const expandedFolders = useAppStore(s => s.expandedFolders)
  const visibilityOverrides = useAppStore(s => s.visibilityOverrides)
  const { t } = useLocale()

  const manualAnimFolderIds = useAppStore(s => s.manualAnimFolderIds)
  const singleMarks = useAppStore(s => s.singleMarks)
  const selectLayer = useAppStore(s => s.selectLayer)
  const selectAnimCell = useAppStore(s => s.selectAnimCell)
  const setFocusedAnimFolder = useAppStore(s => s.setFocusedAnimFolder)
  const toggleLayerVisibility = useAppStore(s => s.toggleLayerVisibility)
  const toggleFolderExpanded = useAppStore(s => s.toggleFolderExpanded)
  const toggleFolderExpandedRecursive = useAppStore(s => s.toggleFolderExpandedRecursive)
  const toggleSingleMark = useAppStore(s => s.toggleSingleMark)
  const toggleManualAnimFolder = useAppStore(s => s.toggleManualAnimFolder)
  const resetVisibility = useAppStore(s => s.resetVisibility)
  const setLayerBlendMode = useAppStore(s => s.setLayerBlendMode)
  const setLayerOpacity = useAppStore(s => s.setLayerOpacity)

  const selectedLayer = useAppStore(s => selectedLayerId ? selectLayerById(s, selectedLayerId) : null)

  const treeRef = useRef<HTMLDivElement>(null)

  const shiftExpandableFolders = useMemo(
    () => collectShiftNavigationExpandableFolders(tree, manualAnimFolderIds),
    [tree, manualAnimFolderIds],
  )
  const navigationExpandedFolders = useMemo(
    () => mergeExpandedFolders(expandedFolders, shiftExpandableFolders),
    [expandedFolders, shiftExpandableFolders],
  )
  const selectedShiftExpandedFolders = useMemo(
    () => selectedLayerId
      ? collectShiftNavigationExpandedPath(
        tree,
        selectedLayerId,
        expandedFolders,
        shiftExpandableFolders,
      )
      : new Set<string>(),
    [tree, selectedLayerId, expandedFolders, shiftExpandableFolders],
  )
  const visibleExpandedFolders = useMemo(
    () => mergeExpandedFolders(expandedFolders, selectedShiftExpandedFolders),
    [expandedFolders, selectedShiftExpandedFolders],
  )

  const scrollLayerIntoView = useCallback((layerId: string) => {
    requestAnimationFrame(() => {
      const el = treeRef.current?.querySelector(`[data-layer-id="${layerId}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    })
  }, [])

  /** Shift+スクロールでレイヤーを上下切り替え（プレビュー連動） */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.shiftKey || tree.length === 0) return
    e.preventDefault()

    const entries = flattenVisible(tree, navigationExpandedFolders, manualAnimFolderIds)
    if (entries.length === 0) return

    const currentIdx = selectedLayerId ? entries.findIndex(e => e.id === selectedLayerId) : -1
    const direction = e.deltaY > 0 ? 1 : -1
    let nextIdx: number
    if (currentIdx < 0) {
      nextIdx = direction > 0 ? 0 : entries.length - 1
    } else {
      nextIdx = Math.max(0, Math.min(entries.length - 1, currentIdx + direction))
    }

    const entry = entries[nextIdx]
    if (entry.id !== selectedLayerId) {
      // handleRowClick と同じ選択ロジックでプレビューを連動
      if (entry.isCell && entry.animParentId) {
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
        selectLayer(entry.id)
      }
      // 選択先が見えるようにスクロール
      scrollLayerIntoView(entry.id)
    }
  }, [
    tree,
    navigationExpandedFolders,
    manualAnimFolderIds,
    singleMarks,
    selectedLayerId,
    selectLayer,
    selectAnimCell,
    setFocusedAnimFolder,
    scrollLayerIntoView,
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
              onToggleExpanded={toggleFolderExpanded}
              onToggleExpandedRecursive={toggleFolderExpandedRecursive}
              onToggleMark={toggleSingleMark}
              onToggleAnimFolder={toggleManualAnimFolder}
              expandedFolders={visibleExpandedFolders}
              visibilityOverrides={visibilityOverrides}
            />
          ))
        )}
      </div>

      <Tooltip content="閉じたアニメフォルダや _ フォルダも一時的に開いて移動します">
        <div className={styles.footerHint}>
          Shift+スクロールでレイヤー移動
        </div>
      </Tooltip>
    </div>
  )
}
