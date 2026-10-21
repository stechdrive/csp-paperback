import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { selectLayerTreeWithVisibility, selectLayerById, selectOutputNavigation, selectOutputAliasTargets } from '../store/selectors'
import { useOutputNavigation } from '../hooks/useOutputNavigation'
import { useDragAutoScroll } from '../hooks/useDragDrop'
import { LayerTreeNode } from './LayerTreeNode'
import { cancelLayerVisibilityDrag } from '../utils/visibility-gesture'
import { BlendOpacityBar } from './BlendOpacityBar'
import { OutputFileList } from './OutputFileList'
import { OutputConnections } from './OutputConnections'
import { QuickLook } from './QuickLook'
import { Tooltip } from './Tooltip'
import { PaneMenu } from './PaneMenu'
import { PaneIcon } from './PaneIcon'
import type { BlendMode } from '../types'
import { findLayerPath, mergeExpandedFolders } from '../utils/layerNavigation'
import styles from './LayerTreePanel.module.css'

// An abandoned edit must not retain the previous document's source images.
const editDocumentKeys = new WeakMap<object, symbol>()
function editDocumentKey(source: object | null): symbol | null {
  if (!source) return null
  let key = editDocumentKeys.get(source)
  if (!key) { key = Symbol(); editDocumentKeys.set(source, key) }
  return key
}

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
  const documentKey = useAppStore(s => editDocumentKey(s.rawPsd))
  const aliasTargets = useAppStore(selectOutputAliasTargets)
  const selectedAlias = useAppStore(s => selectedLayerId ? s.outputAliases.get(selectedLayerId) : undefined)
  const [editingName, setEditingName] = useState<{ id: string; document: symbol | null } | null>(null)
  const editingNameId = editingName?.document === documentKey && aliasTargets.has(editingName.id) ? editingName.id : null
  const handleEditName = useCallback((id: string) => {
    const state = useAppStore.getState()
    if (!selectOutputAliasTargets(state).has(id)) return
    state.selectLayer(id)
    const path = findLayerPath(selectLayerTreeWithVisibility(state), id)
    useAppStore.setState({ transientExpandedFolders: new Set([...state.transientExpandedFolders,
      ...path.slice(0, -1).map(layer => layer.id)]) })
    setEditingName({ id, document: editDocumentKey(state.rawPsd) })
  }, [])
  const handleFinishName = useCallback((restoreFocus: boolean) => {
    setEditingName(null)
    if (restoreFocus) treeRef.current?.focus({ preventScroll: true })
  }, [])
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
      if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]')) return
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
      {/* 選択レイヤーの合成モード・不透明度コントロール */}
      <BlendOpacityBar
        blendMode={selectedLayer?.blendMode ?? 'normal'}
        opacity={selectedLayer?.opacity ?? 100}
        disabled={!selectedLayer}
        showPassThrough={selectedLayer?.isFolder ?? true}
        onBlendModeChange={handleBlendModeChange}
        onOpacityChangeStart={handleOpacityChangeStart}
        onOpacityChange={handleOpacityChange}
        actions={<>
          <Tooltip content="素材単体を確認（Space）"><button className={styles.paneIcon} type="button" disabled={!selectedLayer} aria-label="選択素材をクイックルック"
            onClick={() => selectedLayerId && useAppStore.getState().openQuickLook(selectedLayerId)}><PaneIcon kind="quicklook" /></button></Tooltip>
          <PaneMenu label="素材レイヤーのメニュー">
            <button role="menuitem" disabled={!selectedLayerId || !aliasTargets.has(selectedLayerId)} onClick={event => {
              event.preventDefault(); if (selectedLayerId) handleEditName(selectedLayerId)
            }}>出力名を指定…</button>
            <button role="menuitem" disabled={selectedAlias === undefined} onClick={() => {
              if (selectedLayerId) useAppStore.getState().resetOutputAlias(selectedLayerId)
            }}>元の名前を使う</button>
            <Tooltip content="すべての表示/非表示を読み込み時に戻す（出力にも反映）"><button role="menuitem" onClick={resetVisibility}>{t.layerTree.resetVisibility}</button></Tooltip>
          </PaneMenu>
        </>}
      />

      <div
        className={styles.tree}
        ref={treeRef}
        data-testid="layer-tree"
        tabIndex={0}
        aria-label="素材レイヤー"
        onKeyDown={event => {
          if (event.key === 'F2' && event.target === event.currentTarget && !event.nativeEvent.isComposing && selectedLayerId) {
            event.preventDefault(); handleEditName(selectedLayerId)
          }
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
              editingNameId={editingNameId}
              onEditName={handleEditName}
              onFinishName={handleFinishName}
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
