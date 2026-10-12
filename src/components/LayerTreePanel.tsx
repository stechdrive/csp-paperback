import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { selectLayerTreeWithVisibility, selectLayerById } from '../store/selectors'
import { useOutputNavigation } from '../hooks/useOutputNavigation'
import { useDragAutoScroll } from '../hooks/useDragDrop'
import { LayerTreeNode } from './LayerTreeNode'
import { BlendOpacityBar } from './BlendOpacityBar'
import { Tooltip } from './Tooltip'
import type { BlendMode } from '../types'
import {
  collectShiftNavigationExpandableFolders,
  collectShiftNavigationExpandedPath,
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
  const selectLayer = useAppStore(s => s.selectLayer)
  const toggleLayerVisibility = useAppStore(s => s.toggleLayerVisibility)
  const setFolderExpanded = useAppStore(s => s.setFolderExpanded)
  const setFolderExpandedRecursive = useAppStore(s => s.setFolderExpandedRecursive)
  const toggleSingleMark = useAppStore(s => s.toggleSingleMark)
  const toggleManualAnimFolder = useAppStore(s => s.toggleManualAnimFolder)
  const resetVisibility = useAppStore(s => s.resetVisibility)
  const setLayerBlendMode = useAppStore(s => s.setLayerBlendMode)
  const setLayerOpacity = useAppStore(s => s.setLayerOpacity)
  const pushHistory = useAppStore(s => s.pushHistory)

  const selectedLayer = useAppStore(s => selectedLayerId ? selectLayerById(s, selectedLayerId) : null)

  const treeRef = useRef<HTMLDivElement>(null)
  const dragAutoScrollHandlers = useDragAutoScroll(treeRef)
  const { entries, currentIdx, navigate } = useOutputNavigation()
  const currentOutput = entries[currentIdx]

  const shiftExpandableFolders = useMemo(
    () => collectShiftNavigationExpandableFolders(tree, manualAnimFolderIds, virtualSets),
    [tree, manualAnimFolderIds, virtualSets],
  )
  const selectedShiftExpandedFolders = useMemo(() => {
    const targetId = selectedVirtualSetId
      ? virtualSets.find(vs => vs.id === selectedVirtualSetId)?.insertionLayerId
      : selectedLayerId
    const result = targetId
      ? collectShiftNavigationExpandedPath(tree, targetId, expandedFolders, shiftExpandableFolders, !!currentOutput)
      : new Set<string>()
    for (const id of currentOutput?.ancestorIds ?? []) {
      if (!expandedFolders.has(id)) result.add(id)
    }
    return result
  }, [tree, selectedLayerId, selectedVirtualSetId, virtualSets, expandedFolders, shiftExpandableFolders, currentOutput])
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

  // React's delegated wheel listeners are passive; consume Shift+wheel here so
  // it cannot also horizontally scroll the tree in browsers/WebView2.
  useEffect(() => {
    const element = treeRef.current
    if (!element) return
    let pendingScroll: number | undefined
    const handleWheel = (event: WheelEvent) => {
      const delta = event.deltaY || event.deltaX
      if (!event.shiftKey || !delta || entries.length === 0) return
      event.preventDefault()
      const entry = navigate(delta > 0 ? 1 : -1)
      if (!entry) return
      if (pendingScroll !== undefined) cancelAnimationFrame(pendingScroll)
      pendingScroll = requestAnimationFrame(() => {
        const attribute = entry.kind === 'virtualSet' ? 'data-virtual-set-id' : 'data-layer-id'
        let row = element.querySelector(`[${attribute}="${CSS.escape(entry.id)}"]`)
        // Explicitly collapsed folders stay closed; keep their nearest row in view.
        for (const id of [...entry.ancestorIds].reverse()) {
          if (row) break
          row = element.querySelector(`[data-layer-id="${CSS.escape(id)}"]`)
        }
        row?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      })
    }
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', handleWheel)
      if (pendingScroll !== undefined) cancelAnimationFrame(pendingScroll)
    }
  }, [entries.length, navigate])

  const handleBlendModeChange = useCallback((value: string) => {
    if (!selectedLayerId) return
    setLayerBlendMode(selectedLayerId, value as BlendMode)
  }, [selectedLayerId, setLayerBlendMode])

  const handleOpacityChange = useCallback((value: number) => {
    if (!selectedLayerId) return
    setLayerOpacity(selectedLayerId, value, { recordHistory: false })
  }, [selectedLayerId, setLayerOpacity])

  const handleOpacityChangeStart = useCallback(() => {
    if (!selectedLayerId) return
    pushHistory()
  }, [selectedLayerId, pushHistory])

  return (
    <div className={styles.panel}>
      {/* 選択レイヤーの合成モード・不透明度コントロール */}
      <BlendOpacityBar
        blendMode={selectedLayer?.blendMode ?? 'normal'}
        opacity={selectedLayer?.opacity ?? 100}
        disabled={!selectedLayer}
        showPassThrough={selectedLayer?.isFolder ?? true}
        onBlendModeChange={handleBlendModeChange}
        onOpacityChangeStart={handleOpacityChangeStart}
        onOpacityChange={handleOpacityChange}
        actions={<Tooltip content="すべての表示/非表示を元に戻す（出力には影響しません）">
          <button className={styles.resetBtn} onClick={resetVisibility} aria-label={t.layerTree.resetVisibility} title="表示状態を初期状態に戻す">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8.5M3 4v6h6" /></svg>
          </button>
        </Tooltip>}
      />

      <div
        className={styles.tree}
        ref={treeRef}
        data-testid="layer-tree"
        {...dragAutoScrollHandlers}
      >
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

      <Tooltip content={"書き出される画像ごとに、セル本体・工程別画像・単体出力・仮想セルを巡回します\n補助レイヤーや出力から除外した項目を飛ばして移動します"}>
        <div className={styles.footerHint}>
          Shift+スクロールでプレビュー切替
        </div>
      </Tooltip>
    </div>
  )
}
