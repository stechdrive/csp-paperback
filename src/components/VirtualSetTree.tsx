import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import type { CspLayer, VirtualSet } from '../types'
import type { VirtualSetDropTarget } from '../types/marks'
import { getActiveDragPayload, useDragSource, useInternalDropTarget, type DragPayload } from '../hooks/useDragDrop'
import { planVirtualSetDrop, resolveVirtualSetLayers } from '../utils/virtual-set-tree'
import { findLayerPath } from '../utils/layerNavigation'
import { vsVisibilityDrag } from '../utils/visibility-gesture'
import { LayerTreeRow, LayerVisibility } from './LayerTreeRow'
import { LayerActionsProvider } from './LayerActionsMenu'
import { LayerDiagnosticWarning } from './DiagnosticWarning'
import { Tooltip } from './Tooltip'
import { LayerIcon } from './LayerIcon'
import styles from './VirtualSetTree.module.css'

interface TreeRowProps {
  layer: CspLayer
  vs: VirtualSet
  expanded: Set<string>
  selected: Set<string>
  target: VirtualSetDropTarget | null
  editingId: string | null
  rename: (id: string) => void
  finishRename: (id: string, name: string | null, restoreFocus: boolean) => void
  createFolder: (layer?: CspLayer) => void
  select: (event: MouseEvent, id: string) => void
  expand: (layer: CspLayer, recursive: boolean) => void
}

function NameEditor({ name, className, finish }: { name: string; className: string; finish: (name: string | null, restoreFocus: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null), finished = useRef(false)
  const [value, setValue] = useState(name)
  useLayoutEffect(() => { input.current?.focus(); input.current?.select() }, [])
  const complete = (next: string | null, restoreFocus = true) => {
    if (finished.current) return
    finished.current = true; finish(next, restoreFocus)
  }
  return <input ref={input} className={`${className} ${styles.nameInput}`} value={value} aria-label="レイヤー名を編集"
    onChange={event => setValue(event.target.value)} onBlur={() => complete(value, false)}
    onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}
    onDoubleClick={event => event.stopPropagation()} onKeyDown={event => {
      event.stopPropagation()
      if (event.nativeEvent.isComposing || event.keyCode === 229) return
      if (event.key === 'Enter') { event.preventDefault(); complete(value) }
      if (event.key === 'Escape') { event.preventDefault(); complete(null) }
    }} />
}

function TreeRow({ layer, vs, expanded, selected, target, editingId, rename, finishRename, createFolder, select, expand }: TreeRowProps) {
  const setVisibility = useAppStore(s => s.setVirtualSetVisibilityOverride)
  const mouseHandled = useRef(false)
  const drag = useDragSource({ type: 'virtualSetMember', setId: vs.id,
    layerIds: selected.has(layer.id) ? [...selected] : [layer.id] })
  const visible = vs.visibilityOverrides[layer.id] ?? (!layer.hidden && !layer.uiHidden)
  const drop = target?.layerId === layer.id ? target.position : undefined
  const selectOnly = () => useAppStore.getState().setSelectedVsMember(vs.id, layer.id)
  return <div className={styles.node} data-vs-node-id={layer.id}>
    {drop === 'above' && <div className={styles.insertion} style={{ '--depth': layer.depth } as CSSProperties}
      data-vs-insertion="above" aria-hidden="true" />}
    <LayerTreeRow name={layer.originalName} depth={layer.depth}
      kind={layer.isAnimationFolder ? 'animation' : layer.isFolder ? 'folder' : 'layer'}
      metadata={layer.display} selected={selected.has(layer.id)} dimmed={!visible}
      expanded={expanded.has(layer.id)} onExpand={layer.isFolder ? event => {
        event.stopPropagation(); expand(layer, event.altKey)
      } : undefined}
      dropTarget={drop === 'inside'} className={styles.row}
      data-vs-layer-id={layer.id} data-vs-folder={layer.isFolder ? 'true' : undefined}
      data-vs-depth={layer.depth} data-vs-drop={drop} tabIndex={0}
      onClick={event => select(event, layer.id)}
      draggable={editingId === layer.id ? false : drag.draggable}
      onDragStart={event => {
        event.stopPropagation()
        if (editingId === layer.id) { event.preventDefault(); return }
        drag.onDragStart(event)
      }}
      onDragEnd={drag.onDragEnd} onPointerDown={drag.onPointerDown}
      renderName={className => editingId === layer.id
        ? <NameEditor key={layer.id} name={layer.originalName} className={className} finish={(name, restoreFocus) => finishRename(layer.id, name, restoreFocus)} />
        : <span className={className} data-layer-name onDoubleClick={event => {
          event.stopPropagation(); rename(layer.id)
        }}>{layer.originalName}</span>}
      visibility={<Tooltip content={visible ? 'レイヤーを非表示にする' : 'レイヤーを表示する'}>
        <LayerVisibility hidden={!visible} onMouseDown={event => {
          event.stopPropagation()
          if (event.button !== 0) return
          event.preventDefault(); mouseHandled.current = true
          vsVisibilityDrag.active = true; vsVisibilityDrag.targetVisible = !visible
          setVisibility(vs.id, layer.id, !visible)
        }} onMouseEnter={() => {
          if (vsVisibilityDrag.active && visible !== vsVisibilityDrag.targetVisible)
            setVisibility(vs.id, layer.id, vsVisibilityDrag.targetVisible, { recordHistory: false })
        }} onClick={event => {
          event.stopPropagation()
          if (!mouseHandled.current && event.detail === 0) setVisibility(vs.id, layer.id, !visible)
          mouseHandled.current = false
        }} onKeyDown={() => { mouseHandled.current = false }} />
      </Tooltip>}
      controls={{ select: selectOnly, warning: <LayerDiagnosticWarning layer={layer} />, actions: [
        { id: 'rename', label: '名前を変更', run: () => rename(layer.id) },
        { id: 'newFolder', label: '新規レイヤーフォルダ', run: () => createFolder(layer) },
        { id: 'quicklook', label: '素材をクイックルック', run: () => useAppStore.getState().openQuickLook(layer.id, vs.id) },
        { id: 'remove', label: '仮想セルから取り除く', run: () => useAppStore.getState().removeVirtualSetMember(vs.id, layer.id) },
      ] }} />
    {layer.isFolder && expanded.has(layer.id) && layer.children.map(child =>
      <TreeRow key={child.id} layer={child} vs={vs} expanded={expanded} selected={selected}
        target={target} editingId={editingId} rename={rename} finishRename={finishRename} createFolder={createFolder}
        select={select} expand={expand} />)}
    {drop === 'below' && <div className={`${styles.insertion} ${styles.below}`} style={{ '--depth': layer.depth } as CSSProperties}
      data-vs-insertion="below" aria-hidden="true" />}
  </div>
}

export function VirtualSetTree({ virtualSet: vs }: { virtualSet: VirtualSet }) {
  const { t } = useLocale()
  const source = useAppStore(s => s.layerTree)
  const selectedSet = useAppStore(s => s.selectedVsMemberSetId)
  const selectedLayer = useAppStore(s => s.selectedVsMemberId)
  const insert = useAppStore(s => s.insertVirtualSetLayers)
  const tree = useMemo(() => resolveVirtualSetLayers(source, vs), [source, vs])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState<VirtualSetDropTarget | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const anchor = useRef<string | null>(null), root = useRef<HTMLDivElement | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hoverFolder = useRef<string | null>(null)
  const currentTarget = useRef<VirtualSetDropTarget | null>(null)
  const dropCache = useRef<{ vs: VirtualSet; source: CspLayer[]; payload: DragPayload; key: string; result: VirtualSetDropTarget | null } | undefined>(undefined)
  const visibleRows = useMemo(() => {
    const rows: CspLayer[] = []
    const visit = (layers: CspLayer[]) => layers.forEach(layer => {
      rows.push(layer); if (expanded.has(layer.id)) visit(layer.children)
    })
    visit(tree); return rows
  }, [tree, expanded])
  const selected = selectedSet === vs.id && selectedLayer
    ? selection.has(selectedLayer) ? selection : new Set([selectedLayer]) : new Set<string>()
  const clear = useCallback(() => {
    clearTimeout(openTimer.current); hoverFolder.current = null; currentTarget.current = null; setTarget(null)
  }, [])
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') clear() }
    window.addEventListener('dragend', clear); window.addEventListener('blur', clear); window.addEventListener('keydown', key)
    return () => {
      clearTimeout(openTimer.current)
      window.removeEventListener('dragend', clear); window.removeEventListener('blur', clear); window.removeEventListener('keydown', key)
    }
  }, [clear])
  const payloadIds = (payload: DragPayload): string[] => payload.type === 'layer' || payload.type === 'cell' ? [payload.layerId]
    : payload.type === 'virtualSetMember' && payload.setId === vs.id ? payload.layerIds : []
  const locate = (x: number, y: number): VirtualSetDropTarget => {
    const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-vs-layer-id]')
    if (!row || !root.current?.contains(row)) return { layerId: null, position: 'inside' }
    const rect = row.getBoundingClientRect(), ratio = (y - rect.top) / rect.height
    const inside = row.dataset.vsFolder === 'true' && ratio >= .25 && ratio <= .75 &&
      x >= rect.left + 22 + Number(row.dataset.vsDepth) * 10
    return { layerId: row.dataset.vsLayerId!, position: inside ? 'inside' : ratio < .5 ? 'above' : 'below' }
  }
  const resolve = (payload: DragPayload, x: number, y: number) => {
    const ids = payloadIds(payload), next = locate(x, y)
    const key = `${next.layerId}:${next.position}`, cached = dropCache.current
    if (cached?.vs === vs && cached.source === source && cached.payload === payload && cached.key === key) return cached.result
    const result = ids.length && planVirtualSetDrop(vs, source, ids, next) ? next : null
    dropCache.current = { vs, source, payload, key, result }
    return result
  }
  const hover = (payload: DragPayload, position: { clientX: number; clientY: number }) => {
    const next = resolve(payload, position.clientX, position.clientY)
    if (currentTarget.current?.layerId === next?.layerId && currentTarget.current?.position === next?.position) return
    clearTimeout(openTimer.current)
    currentTarget.current = next; setTarget(next)
    const folder = next?.position === 'inside' ? next.layerId : null
    hoverFolder.current = folder
    if (folder && !expanded.has(folder)) openTimer.current = setTimeout(() => {
      if (hoverFolder.current === folder) setExpanded(previous => new Set([...previous, folder]))
    }, 650)
  }
  const drop = (payload: DragPayload, position: { clientX: number; clientY: number }) => {
    const next = resolve(payload, position.clientX, position.clientY)
    if (next) {
      insert(vs.id, payloadIds(payload), next)
      setSelection(new Set(payloadIds(payload)))
      if (next.position === 'inside' && next.layerId) setExpanded(previous => new Set([...previous, next.layerId!]))
    }
    clear()
  }
  const { dropRef } = useInternalDropTarget({ canDrop: payload => payloadIds(payload).length > 0,
    onDragOver: hover, onDragLeave: clear, onDrop: drop })
  const ref = useCallback((element: HTMLDivElement | null) => { root.current = element; dropRef(element) }, [dropRef])
  const expand = (layer: CspLayer, recursive: boolean) => setExpanded(previous => {
    const next = new Set(previous), open = !previous.has(layer.id)
    const visit = (item: CspLayer) => {
      if (item.isFolder) { if (open) next.add(item.id); else next.delete(item.id) }
      if (recursive) item.children.forEach(visit)
    }
    visit(layer); return next
  })
  const select = (event: MouseEvent, id: string) => {
    event.stopPropagation()
    const ids = visibleRows.map(layer => layer.id), from = ids.indexOf(anchor.current ?? ''), to = ids.indexOf(id)
    if (event.shiftKey && from >= 0) {
      const range = ids.slice(Math.min(from, to), Math.max(from, to) + 1)
      setSelection(new Set(event.ctrlKey || event.metaKey ? [...selected, ...range] : range))
    } else if (event.ctrlKey || event.metaKey) {
      const next = new Set(selected); if (next.has(id)) next.delete(id); else next.add(id)
      setSelection(next); anchor.current = id
      useAppStore.getState().setSelectedVsMember(vs.id, next.has(id) ? id : [...next].at(-1) ?? null)
      return
    } else { setSelection(new Set([id])); anchor.current = id }
    useAppStore.getState().setSelectedVsMember(vs.id, id)
  }
  const rename = (id: string) => {
    setSelection(new Set([id])); useAppStore.getState().setSelectedVsMember(vs.id, id); setEditingId(id)
  }
  const finishRename = (id: string, name: string | null, restoreFocus: boolean) => {
    if (name !== null) useAppStore.getState().renameVirtualSetLayer(vs.id, id, name)
    setEditingId(null)
    if (restoreFocus) requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-vs-layer-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }))
  }
  const createFolder = (layer?: CspLayer) => {
    const destination: VirtualSetDropTarget = layer
      ? { layerId: layer.id, position: layer.isFolder ? 'inside' : 'above' }
      : { layerId: null, position: 'inside' }
    const id = useAppStore.getState().addVirtualSetFolder(vs.id, destination)
    if (!id) return
    const ancestors = layer ? findLayerPath(tree, layer.id).filter(item => item.isFolder).map(item => item.id) : []
    setExpanded(previous => new Set([...previous, ...ancestors, id]))
    setSelection(new Set([id])); anchor.current = id; setEditingId(id)
  }
  return <LayerActionsProvider><div className={styles.editor}>
    <div className={styles.toolbar} role="group" aria-label={`${vs.name}のレイヤー操作`}>
      <span className={styles.toolbarLabel}>{t.virtualSet.layersLabel}</span>
      <Tooltip content="新規レイヤーフォルダ">
        <button type="button" aria-label="新規レイヤーフォルダ" onClick={event => {
          event.stopPropagation()
          createFolder(selectedSet === vs.id && selectedLayer ? findLayerPath(tree, selectedLayer).at(-1) : undefined)
        }}><LayerIcon kind="folder-add" /></button>
      </Tooltip>
      <Tooltip content="選択した要素を仮想セルから取り除く">
        <button type="button" aria-label="選択した要素を仮想セルから取り除く" disabled={selected.size === 0}
          onClick={event => {
            event.stopPropagation()
            useAppStore.getState().removeVirtualSetMembers(vs.id, [...selected])
            setSelection(new Set())
          }}><LayerIcon kind="trash" /></button>
      </Tooltip>
    </div>
    <div ref={ref} className={styles.tree} data-testid="virtual-set-tree" data-vs-tree-id={vs.id}
    aria-label={`${vs.name}のレイヤー`} onDragOver={event => {
      const payload = getActiveDragPayload()
      if (!payload || !payloadIds(payload).length) return
      event.preventDefault(); event.stopPropagation()
      const next = resolve(payload, event.clientX, event.clientY)
      event.dataTransfer.dropEffect = next ? payload.type === 'virtualSetMember' ? 'move' : 'copy' : 'none'
      hover(payload, event)
    }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) clear() }}
    onDrop={event => {
      const payload = getActiveDragPayload()
      if (!payload || !payloadIds(payload).length) return
      event.preventDefault(); event.stopPropagation(); drop(payload, event)
    }} onKeyDown={event => {
      if (event.target instanceof Element && event.target.closest('button, input')) return
      const id = (event.target as HTMLElement).closest<HTMLElement>('[data-vs-layer-id]')?.dataset.vsLayerId
      const layer = visibleRows.find(item => item.id === id)
      if (!layer) return
      if (event.key === 'F2') { event.preventDefault(); event.stopPropagation(); rename(layer.id) }
      if (event.key === ' ') { event.preventDefault(); useAppStore.getState().openQuickLook(layer.id, vs.id) }
      if (event.key === 'ArrowRight' && layer.isFolder && !expanded.has(layer.id) ||
        event.key === 'ArrowLeft' && layer.isFolder && expanded.has(layer.id)) { event.preventDefault(); expand(layer, event.altKey) }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const next = visibleRows[visibleRows.indexOf(layer) + (event.key === 'ArrowDown' ? 1 : -1)]
        if (next) { setSelection(new Set([next.id])); useAppStore.getState().setSelectedVsMember(vs.id, next.id)
          root.current?.querySelector<HTMLElement>(`[data-vs-layer-id="${CSS.escape(next.id)}"]`)?.focus() }
      }
    }}>
    {tree.map(layer => <TreeRow key={layer.id} layer={layer} vs={vs} expanded={expanded} selected={selected}
      target={target} editingId={editingId} rename={rename} finishRename={finishRename} createFolder={createFolder}
      select={select} expand={expand} />)}
    <div className={`${styles.empty} ${target?.layerId === null ? styles.append : ''}`} data-vs-root-drop>
      {tree.length ? '＋ レイヤーをドロップして追加' : t.virtualSet.layersPlaceholder}
    </div>
    </div>
  </div></LayerActionsProvider>
}
