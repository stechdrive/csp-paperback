import { Tooltip } from './Tooltip'
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../store'
import { selectDraftOutputs, selectOutputFiles, selectOutputNavigation } from '../store/selectors'
import { useRenderedOutputs } from '../hooks/useRenderedOutputs'
import { useExport } from '../hooks/useExport'
import { useDismissableLayer } from '../hooks/useDismissableLayer'
import { useVirtualOutputRows } from '../hooks/useVirtualOutputRows'
import { supportsDirectoryExport } from '../utils/directory-builder'
import { observePreviewVisibility } from '../utils/preview-visibility'
import type { OutputFile } from '../utils/output-plan'
import styles from './LayerTreePanel.module.css'
import warningStyles from './RenderWarning.module.css'
import { DiagnosticWarning } from './DiagnosticWarning'
import { outputRenderQueue } from '../utils/output-render-queue'

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase()

const OutputThumbnail = memo(function OutputThumbnail({ file, active }: { file: OutputFile; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (ref.current) return observePreviewVisibility(ref.current, setVisible)
  }, [])
  const files = useMemo(() => [file], [file])
  const [result] = useRenderedOutputs(files, 'thumbnail', active && visible)
  useEffect(() => {
    const canvas = ref.current, image = result?.image?.canvas
    if (!canvas) return
    canvas.width = image?.width ?? 1
    canvas.height = image?.height ?? 1
    if (image) canvas.getContext('2d')?.drawImage(image, 0, 0)
    return () => { canvas.width = 1; canvas.height = 1 }
  }, [result])
  return <Tooltip content={result?.error}><canvas data-tooltip={result?.error} ref={ref} className={styles.outputThumbnail} aria-hidden="true" data-ready={!!result?.image} /></Tooltip>
})

export function OutputFileList({ active = true, onShowTree, onPreview }: { active?: boolean; onShowTree: () => void; onPreview?: () => void }) {
  const files = useAppStore(selectOutputFiles)
  const checks = useRenderedOutputs(files, 'check')
  const checkById = new Map(files.map((file, index) => [file.outputId, checks[index]]))
  const checkedCount = checks.filter(Boolean).length
  const warningCount = checks.filter(result => result?.error || result?.image?.diagnostics?.length).length
  const drafts = useAppStore(selectDraftOutputs)
  const navigation = useAppStore(selectOutputNavigation)
  const activeId = useAppStore(s => s.activeOutputId)
  const selectedIds = useAppStore(s => s.selectedOutputIds)
  const compare = useAppStore(s => s.compareOutputs)
  const [search, setSearch] = useState('')
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const { startExport, isExporting, error } = useExport(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const menuInvoker = useRef<HTMLElement | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const id = useId()
  const query = normalize(search.trim())
  const ordered = useMemo(() => {
    const byId = new Map(files.map(file => [file.sourceLayerId, file]))
    return navigation.entries.flatMap(entry => byId.has(entry.id) ? [byId.get(entry.id)!] : [])
  }, [files, navigation])
  const visible = useMemo(() => [...ordered, ...drafts].filter(file => normalize(file.relativePath).includes(query)), [ordered, drafts, query])
  const selectedIndex = visible.findIndex(file => file.outputId === activeId)
  const virtual = useVirtualOutputRows(list, visible, selectedIndex, active)
  const visibleIds = useMemo(() => new Set(visible.map(file => file.outputId)), [visible])
  const draftIds = useMemo(() => new Set(drafts.map(file => file.outputId)), [drafts])
  const exportIds = new Set(files.filter(file => selectedIds.has(file.outputId)).map(file => file.outputId))
  const hiddenSelected = [...selectedIds].filter(id => !visibleIds.has(id)).length

  const select = useCallback((file: OutputFile, toggle = false, range = false) => {
    useAppStore.getState().selectOutputFile(file.outputId, { toggle, range, orderedIds: visible.map(file => file.outputId) })
    onPreview?.()
  }, [visible, onPreview])
  const move = useCallback((direction: 1 | -1 | 'first' | 'last', range = false) => {
    const state = useAppStore.getState()
    const bySource = new Map(selectOutputFiles(state).map(file => [file.sourceLayerId, file]))
    const currentFiles = [...selectOutputNavigation(state).entries.flatMap(entry => bySource.has(entry.id) ? [bySource.get(entry.id)!] : []), ...selectDraftOutputs(state)]
      .filter(file => normalize(file.relativePath).includes(query))
    if (!currentFiles.length) return
    const index = currentFiles.findIndex(file => file.outputId === state.activeOutputId)
    const next = direction === 'first' ? 0 : direction === 'last' ? currentFiles.length - 1
      : index < 0 ? (direction > 0 ? 0 : currentFiles.length - 1) : Math.max(0, Math.min(currentFiles.length - 1, index + direction))
    state.selectOutputFile(currentFiles[next].outputId, { range, orderedIds: currentFiles.map(file => file.outputId) })
    onPreview?.()
  }, [query, onPreview])
  useEffect(() => {
    const element = list.current
    if (!element) return
    const wheel = (event: WheelEvent) => {
      const delta = event.deltaY || event.deltaX
      if (!event.shiftKey || !delta) return
      event.preventDefault(); event.stopPropagation()
      move(delta > 0 ? 1 : -1)
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [move])
  useDismissableLayer({ open: !!menu, content: menuRef, trigger: moreRef, closeOnTab: true, closeOnScroll: true, closeOnResize: true,
    initialFocus: () => menuRef.current?.querySelector('button:not(:disabled)'),
    onDismiss: reason => { setMenu(null); if (reason === 'escape' || reason === 'tab') menuInvoker.current?.focus({ preventScroll: true }) } })
  const openMenu = (file: OutputFile, x: number, y: number) => {
    menuInvoker.current = list.current
    if (!useAppStore.getState().selectedOutputIds.has(file.outputId)) select(file)
    setMenu({ x: Math.max(4, Math.min(x, window.innerWidth - 230)), y: Math.max(4, Math.min(y, window.innerHeight - 150)) })
  }
  return <>
    <div className={styles.listHeading}><Tooltip content="Shift+スクロールで出力を切り替え"><strong data-tooltip="Shift+スクロールで出力を切り替え">出力一覧</strong></Tooltip><span className={styles.fileCount}>{files.length}件</span>
      <Tooltip content="選択中の出力をツリーで表示"><button data-tooltip="選択中の出力をツリーで表示" type="button" onClick={onShowTree} disabled={!activeId} aria-label="選択中の出力をツリーで表示">↗</button></Tooltip></div>
    <div className={styles.listTools}>
      <input type="search" aria-label="出力ファイル名を検索" placeholder="ファイル名を検索" value={search} onChange={event => setSearch(event.target.value)} />
    </div>
    {warningCount > 0 && <div className={warningStyles.status} role="status">要確認 {warningCount}件</div>}
    <div ref={list} className={styles.fileList} role="listbox" tabIndex={0} aria-label="出力ファイル" aria-multiselectable="true"
      aria-busy={checkedCount < files.length}
      aria-activedescendant={selectedIndex >= 0 ? `${id}-${selectedIndex}` : undefined}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return
        const direction = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : null
        if (direction !== null) { event.preventDefault(); move(direction, event.shiftKey) }
        if ((event.ctrlKey || event.metaKey) && event.key === 'a') { event.preventDefault(); useAppStore.setState({ selectedOutputIds: new Set(visible.map(file => file.outputId)) }) }
        if ((event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) && selectedIndex >= 0) {
          event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); openMenu(visible[selectedIndex], rect.left + 10, rect.top + 20)
        }
      }}>
      {!!visible.length && <div className={styles.virtualRows} style={{ height: virtual.height }}>
      {virtual.indices.map(index => { const file = visible[index]; return <div key={file.outputId} className={styles.virtualRow} data-virtual-row={index} style={{ top: virtual.offsets[index] }}>
        {draftIds.has(file.outputId) && !draftIds.has(visible[index - 1]?.outputId) && <div className={styles.draftHeading}>未配置の仮想セル · 書き出し対象外</div>}
        <Tooltip content={file.relativePath}><div data-tooltip={file.relativePath} id={`${id}-${index}`} role="option" aria-label={file.relativePath} aria-selected={selectedIds.has(file.outputId)} aria-posinset={index + 1} aria-setsize={visible.length} className={styles.fileRow}
          data-output-id={file.outputId} data-output-source-id={file.sourceLayerId} data-active-output={file.outputId === activeId}
          onClick={event => { list.current?.focus(); select(file, event.ctrlKey || event.metaKey, event.shiftKey) }}
          onContextMenu={event => { event.preventDefault(); openMenu(file, event.clientX, event.clientY) }}>
          <OutputThumbnail file={file} active={active} /><span data-output-name>{file.relativePath}</span>
          {!draftIds.has(file.outputId) && <DiagnosticWarning issues={checkById.get(file.outputId)?.image?.diagnostics}
            error={checkById.get(file.outputId)?.error} onRetry={checkById.get(file.outputId)?.error ? () => outputRenderQueue.retry(file) : undefined} />}
        </div></Tooltip>
      </div> })}</div>}
      {!visible.length && <div className={styles.empty}>{query ? '一致するファイルはありません' : '現在の設定で出力されるファイルはありません'}</div>}
    </div>
    <div className={styles.selectionTools}>
      <span>{selectedIds.size}選択{hiddenSelected > 0 ? `（一覧外${hiddenSelected}）` : ''}</span>
      <Tooltip content="8件まで、ズームと表示幅に合わせて並べます。1件を選ぶと原寸で確認できます。"><button data-tooltip="8件まで、ズームと表示幅に合わせて並べます。1件を選ぶと原寸で確認できます。" type="button" aria-label="選択項目を並べて表示" aria-pressed={compare} disabled={selectedIds.size < 2 || selectedIds.size > 8}
        onClick={() => { useAppStore.getState().setCompareOutputs(!compare); onPreview?.() }}>並べて表示</button></Tooltip>
      <button ref={moreRef} type="button" aria-label="選択項目の操作" aria-haspopup="menu" aria-expanded={!!menu} disabled={!exportIds.size} onClick={event => {
        menuInvoker.current = event.currentTarget
        const rect = event.currentTarget.getBoundingClientRect(); setMenu(menu ? null : { x: Math.max(4, Math.min(rect.left, window.innerWidth - 230)), y: Math.max(4, rect.top - 144) })
      }}>⋯</button>
    </div>
    {error && <div className={styles.exportError} role="alert">{error}</div>}
    {menu && createPortal(<div ref={menuRef} role="menu" aria-label="選択した出力の操作" className={styles.outputMenu} style={{ left: menu.x, top: menu.y }}
      onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
        buttons[next]?.focus()
      }}>
      <span>{exportIds.size}件を書き出し</span>
      <button role="menuitem" disabled={isExporting || !exportIds.size} onClick={() => { setMenu(null); list.current?.focus(); void startExport('zip', exportIds) }}>選択項目をZIPに書き出し</button>
      {supportsDirectoryExport() && <button role="menuitem" disabled={isExporting || !exportIds.size} onClick={() => { setMenu(null); list.current?.focus(); void startExport('directory', exportIds) }}>選択項目をフォルダに書き出し</button>}
    </div>, document.body)}
  </>
}
