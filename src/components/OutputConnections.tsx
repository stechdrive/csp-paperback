import { Tooltip } from './Tooltip'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../store'
import { selectDraftOutputs, selectLayerTreeWithVisibility, selectOutputFiles, selectOutputAliasTargets } from '../store/selectors'
import { describeOutputSource } from '../utils/output-alias'
import { useRenderedOutputs } from '../hooks/useRenderedOutputs'
import { useDismissableLayer } from '../hooks/useDismissableLayer'
import type { CspLayer } from '../types'
import type { OutputFile } from '../utils/output-plan'
import styles from './LayerTreePanel.module.css'

type Edge = 'above' | 'below'
interface SourceRow { id: string; path: string; count: number; content: boolean }
interface Endpoint { kind: 'sources' | 'output'; edge: Edge; x: number; y: number; width: number; height: number; sources: SourceRow[] }
interface Connection { d: string; context: boolean; targetId?: string; edge?: Edge }
interface Popup { file: OutputFile; edge: Edge; sources: SourceRow[]; trigger: HTMLButtonElement; left: number; top?: number; bottom?: number; width: number; maxHeight: number }
const directionName = (edge: Edge) => edge === 'above' ? '上' : '下'
const arrow = (edge: Edge) => edge === 'above' ? '↑' : '↓'

export function OutputConnections({ container, treeElement, active = true }: { container: RefObject<HTMLDivElement | null>; treeElement: RefObject<HTMLDivElement | null>; active?: boolean }) {
  const files = useAppStore(selectOutputFiles)
  const drafts = useAppStore(selectDraftOutputs)
  const tree = useAppStore(selectLayerTreeWithVisibility)
  const aliases = useAppStore(s => s.outputAliases)
  const aliasTargets = useAppStore(selectOutputAliasTargets)
  const activeId = useAppStore(s => s.activeOutputId)
  const selected = useMemo(() => [...files, ...drafts].filter(file => file.outputId === activeId), [files, drafts, activeId])
  const [result] = useRenderedOutputs(selected, 'thumbnail', active)
  const [geometry, setGeometry] = useState<{ paths: Connection[]; endpoints: Endpoint[] }>({ paths: [], endpoints: [] })
  const [popup, setPopup] = useState<Popup | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const visiblePopup = popup?.file === selected[0] ? popup : null
  const layerPaths = useMemo(() => {
    const paths = new Map<string, CspLayer[]>()
    const walk = (layers: CspLayer[], parents: CspLayer[]) => layers.forEach(layer => {
      const path = [...parents, layer]
      paths.set(layer.id, path)
      walk(layer.children, path)
    })
    walk(tree, [])
    return paths
  }, [tree])

  useEffect(() => {
    const root = container.current, treeRoot = treeElement.current
    const fileList = root?.querySelector<HTMLElement>('[role="listbox"]')
    if (!root || !treeRoot || !fileList) return
    let frame = 0
    const marked = new Set<HTMLElement>()
    const clear = () => marked.forEach(row => {
      delete row.dataset.sourceRole
      const virtualUse = row.querySelector<HTMLElement>('[data-layer-virtual-use]')
      if (virtualUse) virtualUse.hidden = true
      row.removeAttribute('aria-description')
    })
    const update = () => {
      frame = 0; clear(); marked.clear()
      const fileRow = fileList.querySelector<HTMLElement>('[data-active-output="true"]')
      const viewport = treeRoot.getBoundingClientRect()
      if (!result?.image || !fileRow || !viewport.height || !viewport.width) { setGeometry({ paths: [], endpoints: [] }); return }
      const rows = new Map([...treeRoot.querySelectorAll<HTMLElement>('[data-layer-id]')].map(row => [row.dataset.layerId!, row]))
      const used = new Map<HTMLElement, SourceRow>()
      for (const id of result.image.sources.all) {
        const path = layerPaths.get(id) ?? []
        const visible = [...path].reverse().find(layer => rows.has(layer.id))
        if (!visible) continue
        const row = rows.get(visible.id)!, value = used.get(row) ?? {
          id: visible.id, path: (layerPaths.get(visible.id) ?? []).map(layer => describeOutputSource(layer,
            aliasTargets.has(layer.id) ? aliases.get(layer.id) : undefined)).join(' / '), count: 0, content: false,
        }
        value.count++; value.content ||= result.image.sources.content.has(id)
        used.set(row, value)
      }
      const bounds = root.getBoundingClientRect(), origin = fileRow.getBoundingClientRect()
      const fileViewport = fileRow.closest('[role="listbox"]')!.getBoundingClientRect()
      const horizontal = fileViewport.right < viewport.left + 4
      const height = Math.min(26, viewport.height / 3, fileViewport.height / 3)
      const endpoints: Endpoint[] = []
      const originCenter = (origin.top + origin.bottom) / 2
      const outputEdge = originCenter < fileViewport.top ? 'above' : originCenter > fileViewport.bottom ? 'below' : undefined
      const sx = horizontal ? fileViewport.right - bounds.left : fileViewport.right - bounds.left - 4
      const sy = (outputEdge ? (outputEdge === 'above' ? fileViewport.top + height / 2 + 2 : fileViewport.bottom - height / 2 - 2) : originCenter) - bounds.top
      if (outputEdge) endpoints.push({ kind: 'output', edge: outputEdge, x: fileViewport.left - bounds.left + 4,
        y: sy - height / 2, width: Math.max(0, fileViewport.width - 8), height, sources: [] })

      // Work in tree order. Closed folders represent their contributing descendants.
      const targets = [...rows.values()].flatMap(row => {
        const value = used.get(row)
        if (!value) return []
        marked.add(row)
        row.dataset.sourceRole = value.content ? 'content' : 'context'
        const hidden = layerPaths.get(value.id)?.some(layer => layer.hidden || layer.uiHidden)
        const virtualUse = row.querySelector<HTMLElement>('[data-layer-virtual-use]')
        if (virtualUse) virtualUse.hidden = !hidden
        row.setAttribute('aria-description', hidden ? '元のレイヤーは非表示ですが、仮想セル内の表示設定で使用しています' : value.content ? '選択した出力の素材' : '一緒に合成する用紙・指示など')
        const rect = row.getBoundingClientRect()
        return [{ value, center: (rect.top + rect.bottom) / 2 }]
      })
      // Include rows under the edge buttons in their corresponding group, so
      // every connection ends at a visible destination.
      const top = viewport.top + (targets.some(target => target.center < viewport.top + 2) ? height + 4 : 2)
      const bottom = viewport.bottom - (targets.some(target => target.center > viewport.bottom - 2) ? height + 4 : 2)
      const hiddenSources: Record<Edge, SourceRow[]> = { above: [], below: [] }
      const paths: Connection[] = []
      const connect = (tx: number, ty: number) => {
        const mx = (sx + tx) / 2
        const gapY = viewport.top - bounds.top - 4
        return horizontal ? `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`
          : `M${sx},${sy} L${sx},${gapY} L${tx},${gapY} L${tx},${ty}`
      }
      targets.forEach(({ value, center }) => {
        if (center < top) hiddenSources.above.push(value)
        else if (center > bottom) hiddenSources.below.push(value)
        else paths.push({ d: connect(viewport.left - bounds.left + 3, center - bounds.top), context: !value.content, targetId: value.id })
      })
      for (const edge of ['above', 'below'] as const) {
        const sources = hiddenSources[edge]
        if (!sources.length) continue
        const x = viewport.left - bounds.left + 3
        const y = (edge === 'above' ? viewport.top + 2 : viewport.bottom - height - 2) - bounds.top
        endpoints.push({ kind: 'sources', edge, x, y, width: Math.max(0, viewport.width - 10), height, sources })
        paths.push({ d: connect(x, y + height / 2), context: !sources.some(source => source.content), edge })
      }
      setGeometry({ paths, endpoints })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    const observer = new ResizeObserver(schedule)
    observer.observe(root); observer.observe(treeRoot); observer.observe(fileList)
    const mutation = new MutationObserver(schedule)
    mutation.observe(treeRoot, { childList: true, subtree: true })
    mutation.observe(fileList, { childList: true, subtree: true })
    // These absolute overlays use the relationship pane as their containing
    // block. WebView2 can skip their DOM scroller for the wheel default action.
    const wheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.shiftKey || event.ctrlKey || event.metaKey) return
      const endpoint = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-connection-kind]') : null
      if (!endpoint) return
      const scroller = endpoint.dataset.connectionKind === 'sources' ? treeRoot : fileList
      const lineHeight = parseFloat(getComputedStyle(scroller).lineHeight) || 20
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? lineHeight : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? scroller.clientHeight : 1
      event.preventDefault()
      scroller.scrollBy({ top: event.deltaY * unit, left: event.deltaX * unit })
    }
    root.addEventListener('scroll', schedule, true)
    fileList.addEventListener('output-layout', schedule)
    root.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('resize', schedule)
    schedule()
    return () => { clear(); cancelAnimationFrame(frame); observer.disconnect(); mutation.disconnect(); root.removeEventListener('scroll', schedule, true); fileList.removeEventListener('output-layout', schedule); root.removeEventListener('wheel', wheel); window.removeEventListener('resize', schedule) }
  }, [activeId, result, layerPaths, container, treeElement, aliases, aliasTargets])

  useDismissableLayer({ open: !!visiblePopup, content: popupRef, trigger: { current: visiblePopup?.trigger ?? null },
    closeOnScroll: true, closeOnResize: true, initialFocus: () => popupRef.current?.querySelector('button'),
    onDismiss: reason => {
      setPopup(null)
      if (reason === 'escape' && visiblePopup?.trigger.isConnected) visiblePopup.trigger.focus({ preventScroll: true })
    } })

  return <>
    <svg className={styles.connections} aria-hidden="true" data-testid="output-connections">
      {geometry.paths.map((path, i) => <path key={i} d={path.d} className={path.context ? styles.contextLine : undefined}
        data-target-layer-id={path.targetId} data-offscreen-edge={path.edge} />)}
    </svg>
    {geometry.endpoints.map(endpoint => {
      const parent = endpoint.kind === 'sources' ? treeElement.current : container.current?.querySelector('[role="listbox"]')
      if (!parent) return null
      // Keep the overlay inside its scroller in the DOM: native wheel events and
      // Shift+wheel navigation must behave exactly like the rows beneath it.
      return createPortal(<Tooltip content={endpoint.kind === 'sources' ? endpoint.sources.map(source => source.path).join('\n') : selected[0]?.relativePath}><button data-tooltip={endpoint.kind === 'sources' ? endpoint.sources.map(source => source.path).join('\n') : selected[0]?.relativePath} type="button"
      className={styles.connectionEndpoint} style={{ left: endpoint.x, top: endpoint.y, width: endpoint.width, height: endpoint.height }}
      data-connection-kind={endpoint.kind} data-connection-edge={endpoint.edge}
      aria-label={endpoint.kind === 'sources' ? `${directionName(endpoint.edge)}にある合成元${endpoint.sources.length}項目を表示` : '選択中の出力へ戻る'}
      aria-haspopup={endpoint.kind === 'sources' ? 'dialog' : undefined}
      aria-expanded={endpoint.kind === 'sources' ? visiblePopup?.edge === endpoint.edge : undefined}
      onClick={event => {
        if (endpoint.kind === 'output') {
          const list = container.current?.querySelector<HTMLElement>('[role="listbox"]')
          list?.dispatchEvent(new Event('output-scroll-active'))
          list?.focus({ preventScroll: true })
          return
        }
        if (visiblePopup?.edge === endpoint.edge) { setPopup(null); return }
        if (!selected[0]) return
        const rect = event.currentTarget.getBoundingClientRect()
        const width = Math.min(420, window.innerWidth - 16)
        const above = Math.max(0, rect.top - 14), below = Math.max(0, window.innerHeight - rect.bottom - 14)
        const useBelow = below >= 320 || below > above
        const maxHeight = Math.min(320, useBelow ? below : above)
        setPopup({ file: selected[0], edge: endpoint.edge, sources: endpoint.sources, trigger: event.currentTarget, width, maxHeight,
          left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
          ...(useBelow ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }) })
      }}>
      <span>{arrow(endpoint.edge)} {endpoint.kind === 'sources' ? `${endpoint.sources.length}項目` : '選択中'}</span>
      <span className={styles.endpointName}>{endpoint.kind === 'sources' ? endpoint.sources[endpoint.edge === 'above' ? endpoint.sources.length - 1 : 0]?.path : selected[0]?.relativePath}</span>
      {endpoint.kind === 'sources' && <span aria-hidden="true">⋯</span>}
    </button></Tooltip>, parent, `${endpoint.kind}-${endpoint.edge}`)
    })}
    {visiblePopup && createPortal(<div ref={popupRef} role="dialog" aria-label="画面外の合成元" className={styles.sourcePopup}
      style={{ left: visiblePopup.left, top: visiblePopup.top, bottom: visiblePopup.bottom, width: visiblePopup.width, maxHeight: visiblePopup.maxHeight }}>
      <header><strong>{directionName(visiblePopup.edge)}にある合成元 · {visiblePopup.sources.length}項目</strong>
        <button type="button" aria-label="合成元の一覧を閉じる" onClick={() => { setPopup(null); visiblePopup.trigger.focus({ preventScroll: true }) }}>✕</button></header>
      <ul>{visiblePopup.sources.map(source => <li key={source.id}><button type="button" data-source-id={source.id}
        onClick={() => {
          const element = treeElement.current?.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(source.id)}"]`)
          element?.scrollIntoView({ block: 'center', inline: 'nearest' })
          setPopup(null); treeElement.current?.focus({ preventScroll: true })
        }}><span>{source.path}</span><small>{source.content ? '出力の素材' : '共通の用紙・指示など'}{source.count > 1 ? ` · ${source.count}要素` : ''}</small></button></li>)}</ul>
    </div>, document.body)}
  </>
}
