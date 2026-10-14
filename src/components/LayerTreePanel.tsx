import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { selectLayerTreeWithVisibility, selectLayerById } from '../store/selectors'
import { useOutputNavigation } from '../hooks/useOutputNavigation'
import { useDragAutoScroll } from '../hooks/useDragDrop'
import { LayerTreeNode } from './LayerTreeNode'
import { BlendOpacityBar } from './BlendOpacityBar'
import { OutputFileList } from './OutputFileList'
import { Tooltip } from './Tooltip'
import type { BlendMode } from '../types'
import { mergeExpandedFolders } from '../utils/layerNavigation'
import styles from './LayerTreePanel.module.css'

export function LayerTreePanel({ onPreviewOutput }: { onPreviewOutput?: () => void }) {
  const [view, setView] = useState<'tree' | 'files'>('tree')
  const tree = useAppStore(selectLayerTreeWithVisibility)
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const expandedFolders = useAppStore(s => s.expandedFolders)
  const revealedFolders = useAppStore(s => s.transientExpandedFolders)
  const visibilityOverrides = useAppStore(s => s.visibilityOverrides)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const { t } = useLocale()

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

  const selectedLayer = useAppStore(s => selectedLayerId && !selectedVirtualSetId ? selectLayerById(s, selectedLayerId) : null)

  const treeRef = useRef<HTMLDivElement>(null)
  const dragAutoScrollHandlers = useDragAutoScroll(treeRef)
  const { entries, navigate, revealCurrent } = useOutputNavigation()
  const visibleExpandedFolders = useMemo(
    () => mergeExpandedFolders(expandedFolders, revealedFolders),
    [expandedFolders, revealedFolders],
  )
  const transientExpandedFolders = useMemo(
    () => new Set([...revealedFolders].filter(id => !expandedFolders.has(id))),
    [revealedFolders, expandedFolders],
  )

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
        // A manual action may close the path before this animation frame runs.
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
      <div className={styles.contents} hidden={view !== 'tree'}>
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
              selectedLayerId={selectedVirtualSetId ? null : selectedLayerId}
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
      </div>

      <div className={styles.contents} hidden={view !== 'files'}>
        <OutputFileList active={view === 'files'} onPreview={onPreviewOutput} onShowTree={() => {
          const entry = revealCurrent()
          setView('tree')
          requestAnimationFrame(() => {
            if (!entry) return
            const attr = entry.kind === 'virtualSet' ? 'data-virtual-set-id' : 'data-layer-id'
            treeRef.current?.querySelector(`[${attr}="${CSS.escape(entry.id)}"]`)?.scrollIntoView({ block: 'nearest' })
          })
        }} />
      </div>

      <div className={styles.footer} data-testid="layer-panel-footer">
        <div className={styles.viewSwitch} role="group" aria-label="レイヤーパネルの表示">
          <button type="button" aria-label="レイヤー" title="レイヤー" aria-pressed={view === 'tree'} onClick={() => setView('tree')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5" /></svg>
            <span className={styles.viewLabel}>レイヤー</span>
          </button>
          <button type="button" aria-label="出力一覧" title="出力一覧" aria-pressed={view === 'files'} onClick={() => setView('files')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1" /></svg>
            <span className={styles.viewLabel}>出力一覧</span>
          </button>
        </div>
        <Tooltip content={"Shift+スクロールでプレビュー切替\n書き出される画像ごとに、セル本体・工程別画像・個別書き出し・仮想セルを巡回します\n出力行まで一時展開し、離れると元に戻します。手動で開いたフォルダは維持します"}>
          <span className={styles.footerHint}>Shift+スクロール<span className={styles.hintAction}>で切替</span></span>
        </Tooltip>
      </div>
    </div>
  )
}
