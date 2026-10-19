import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { selectLayerTreeWithVisibility, selectLayerById, selectOutputNavigation } from '../store/selectors'
import { useOutputNavigation } from '../hooks/useOutputNavigation'
import { useDragAutoScroll } from '../hooks/useDragDrop'
import { LayerTreeNode } from './LayerTreeNode'
import { cancelLayerVisibilityDrag } from '../utils/visibility-gesture'
import { BlendOpacityBar } from './BlendOpacityBar'
import { OutputFileList } from './OutputFileList'
import { OutputConnections } from './OutputConnections'
import { QuickLook } from './QuickLook'
import { Tooltip } from './Tooltip'
import type { BlendMode } from '../types'
import { mergeExpandedFolders } from '../utils/layerNavigation'
import styles from './LayerTreePanel.module.css'

export function LayerTreePanel({ active = true, onPreviewOutput }: { active?: boolean; onPreviewOutput?: () => void }) {
  const relationshipRef = useRef<HTMLDivElement>(null)
  const documentTree = useAppStore(s => s.layerTree)
  useEffect(() => cancelLayerVisibilityDrag, [documentTree])
  const tree = useAppStore(selectLayerTreeWithVisibility)
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const expandedFolders = useAppStore(s => s.expandedFolders)
  const revealedFolders = useAppStore(s => s.transientExpandedFolders)
  const visibilityOverrides = useAppStore(s => s.visibilityOverrides)
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

  const selectedLayer = useAppStore(s => selectedLayerId ? selectLayerById(s, selectedLayerId) : null)

  const treeRef = useRef<HTMLDivElement>(null)
  const handleSelectLayer = useCallback((id: string) => {
    selectLayer(id); treeRef.current?.focus({ preventScroll: true })
  }, [selectLayer])
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
      if (!event.shiftKey || !delta || selectOutputNavigation(useAppStore.getState()).entries.length === 0) return
      event.preventDefault()
      event.stopPropagation()
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
      <div ref={relationshipRef} className={styles.relationship}>
      <div className={styles.outputs}>
        <OutputFileList active={active} onPreview={onPreviewOutput} onShowTree={() => {
          const entry = revealCurrent()
          requestAnimationFrame(() => {
            if (!entry) return
            const attr = entry.kind === 'virtualSet' ? 'data-virtual-set-id' : 'data-layer-id'
            treeRef.current?.querySelector(`[${attr}="${CSS.escape(entry.id)}"]`)?.scrollIntoView({ block: 'nearest' })
          })
        }} />
      </div>
      <div className={styles.contents}>
      <div className={styles.listHeading}><strong>素材レイヤー</strong>
        <Tooltip content="素材単体を確認（Space）"><button data-tooltip="素材単体を確認（Space）" type="button" disabled={!selectedLayer} aria-label="選択素材をクイックルック"
          onClick={() => selectedLayerId && useAppStore.getState().openQuickLook(selectedLayerId)}>⌕</button></Tooltip>
      </div>
      {/* 選択レイヤーの合成モード・不透明度コントロール */}
      <BlendOpacityBar
        blendMode={selectedLayer?.blendMode ?? 'normal'}
        opacity={selectedLayer?.opacity ?? 100}
        disabled={!selectedLayer}
        showPassThrough={selectedLayer?.isFolder ?? true}
        onBlendModeChange={handleBlendModeChange}
        onOpacityChangeStart={handleOpacityChangeStart}
        onOpacityChange={handleOpacityChange}
        actions={<Tooltip content="すべての表示/非表示を読み込み時に戻す（出力にも反映）">
          <button className={styles.resetBtn} onClick={resetVisibility} aria-label={t.layerTree.resetVisibility}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8.5M3 4v6h6" /></svg>
          </button>
        </Tooltip>}
      />

      <div
        className={styles.tree}
        ref={treeRef}
        data-testid="layer-tree"
        tabIndex={0}
        aria-label="素材レイヤー"
        onKeyDown={event => {
          if (event.key === ' ' && event.target === event.currentTarget && !event.nativeEvent.isComposing && selectedLayerId) {
            event.preventDefault(); useAppStore.getState().openQuickLook(selectedLayerId)
          }
        }}
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
              onSelect={handleSelectLayer}
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

      <OutputConnections active={active} container={relationshipRef} treeElement={treeRef} />
      </div>

      <QuickLook />
    </div>
  )
}
