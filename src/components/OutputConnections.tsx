import { useEffect, useMemo, useState, type RefObject } from 'react'
import { useAppStore } from '../store'
import { selectDraftOutputs, selectLayerTreeWithVisibility, selectOutputFiles } from '../store/selectors'
import { useRenderedOutputs } from '../hooks/useRenderedOutputs'
import { findLayerPath } from '../utils/layerNavigation'
import styles from './LayerTreePanel.module.css'

export function OutputConnections({ container, treeElement }: { container: RefObject<HTMLDivElement | null>; treeElement: RefObject<HTMLDivElement | null> }) {
  const files = useAppStore(selectOutputFiles)
  const drafts = useAppStore(selectDraftOutputs)
  const tree = useAppStore(selectLayerTreeWithVisibility)
  const activeId = useAppStore(s => s.activeOutputId)
  const selected = useMemo(() => [...files, ...drafts].filter(file => file.outputId === activeId), [files, drafts, activeId])
  const [result] = useRenderedOutputs(selected, 'full')
  const [paths, setPaths] = useState<{ d: string; context: boolean }[]>([])
  const [outside, setOutside] = useState('')
  useEffect(() => {
    const root = container.current, treeRoot = treeElement.current
    if (!root || !treeRoot) return
    let frame = 0
    const marked = new Set<HTMLElement>()
    const clear = () => marked.forEach(row => { delete row.dataset.sourceRole; delete row.dataset.contributionCount; row.removeAttribute('aria-description') })
    const update = () => {
      frame = 0; clear(); marked.clear()
      const fileRow = [...root.querySelectorAll<HTMLElement>('[data-output-id]')].find(row => row.dataset.outputId === activeId)
      if (!result?.image || !fileRow) { setPaths([]); setOutside(''); return }
      const rows = new Map([...treeRoot.querySelectorAll<HTMLElement>('[data-layer-id]')].map(row => [row.dataset.layerId!, row]))
      const used = new Map<HTMLElement, { count: number; content: boolean }>()
      for (const id of result.image.sources.all) {
        const path = findLayerPath(tree, id)
        const visible = [...path].reverse().find(layer => rows.has(layer.id))
        if (!visible) continue
        const row = rows.get(visible.id)!, value = used.get(row) ?? { count: 0, content: false }
        value.count++; value.content ||= result.image.sources.content.has(id)
        used.set(row, value)
      }
      const bounds = root.getBoundingClientRect(), viewport = treeRoot.getBoundingClientRect()
      const origin = fileRow.getBoundingClientRect()
      const fileViewport = fileRow.closest('[role="listbox"]')!.getBoundingClientRect()
      const horizontal = fileViewport.right < viewport.left + 4
      const sx = horizontal ? origin.right - bounds.left : Math.min(origin.right - bounds.left - 8, bounds.width - 12)
      const sy = Math.max(fileViewport.top + 3, Math.min(fileViewport.bottom - 3, (origin.top + origin.bottom) / 2)) - bounds.top
      const next: { d: string; context: boolean }[] = []
      let above = 0, below = 0
      used.forEach((value, row) => {
        marked.add(row)
        row.dataset.sourceRole = value.content ? 'content' : 'context'
        const hidden = findLayerPath(tree, row.dataset.layerId!).some(layer => layer.hidden || layer.uiHidden)
        row.dataset.contributionCount = hidden ? '仮想セルで使用' : value.count > 1 ? `${value.count}要素` : '使用'
        row.setAttribute('aria-description', hidden ? '元の目玉はOFFですが、仮想セル内の表示設定で使用しています' : value.content ? '選択した出力の素材' : '一緒に合成する用紙・指示など')
        const rect = row.getBoundingClientRect()
        if (rect.bottom <= viewport.top) { above++; return }
        if (rect.top >= viewport.bottom) { below++; return }
        const tx = viewport.left - bounds.left + 3
        const ty = Math.max(viewport.top + 2, Math.min(viewport.bottom - 2, (rect.top + rect.bottom) / 2)) - bounds.top
        const mx = (sx + tx) / 2
        next.push({ d: horizontal ? `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}` : `M${sx},${sy} L${sx},${viewport.top - bounds.top + 2} L${tx},${viewport.top - bounds.top + 2} L${tx},${ty}`, context: !value.content })
      })
      setPaths(next); setOutside([above ? `↑画面外${above}` : '', below ? `↓画面外${below}` : ''].filter(Boolean).join(' · '))
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    const observer = new ResizeObserver(schedule)
    observer.observe(root); observer.observe(treeRoot)
    const mutation = new MutationObserver(schedule)
    mutation.observe(treeRoot, { childList: true, subtree: true })
    root.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    schedule()
    return () => { clear(); cancelAnimationFrame(frame); observer.disconnect(); mutation.disconnect(); root.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule) }
  }, [activeId, result, tree, container, treeElement])
  return <>
    <svg className={styles.connections} aria-hidden="true" data-testid="output-connections">
      {paths.map((path, i) => <path key={i} d={path.d} className={path.context ? styles.contextLine : undefined} />)}
    </svg>
    {outside && <span className={styles.outsideSources}>{outside}</span>}
  </>
}
