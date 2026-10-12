import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store'
import { selectOutputFiles, selectOutputNavigation } from '../store/selectors'
import { findOutputNavigationIndex } from '../utils/output-navigation'
import styles from './LayerTreePanel.module.css'

function normalize(value: string) { return value.normalize('NFKC').toLocaleLowerCase() }

export function OutputFileList({ active, onShowTree, onPreview }: { active: boolean; onShowTree: () => void; onPreview?: () => void }) {
  const files = useAppStore(selectOutputFiles)
  const navigation = useAppStore(selectOutputNavigation)
  const selectedLayerId = useAppStore(s => s.selectedOutputSourceId ?? s.selectedLayerId)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const [search, setSearch] = useState('')
  const query = normalize(search.trim())
  const list = useRef<HTMLDivElement>(null)
  const id = useId()
  const ordered = useMemo(() => {
    const byId = new Map(files.map(file => [file.sourceLayerId, file]))
    return navigation.entries.flatMap(entry => {
      const file = byId.get(entry.id)
      return file ? [file] : []
    })
  }, [files, navigation])
  const visible = useMemo(() => ordered.filter(file => normalize(file.relativePath).includes(query)), [ordered, query])
  const current = findOutputNavigationIndex(navigation.entries, selectedLayerId, selectedVirtualSetId)
  const selectedId = navigation.entries[current]?.id
  const selectedIndex = visible.findIndex(file => file.sourceLayerId === selectedId)

  const select = useCallback((sourceId: string) => {
    const state = useAppStore.getState()
    const entry = selectOutputNavigation(state).entries.find(entry => entry.id === sourceId)
    if (entry && state.selectOutputEntry(entry)) onPreview?.()
  }, [onPreview])

  const move = useCallback((direction: 1 | -1 | 'first' | 'last') => {
    // Read current selection and eligibility for every event, including rapid wheel bursts.
    const state = useAppStore.getState()
    const names = new Map(selectOutputFiles(state).map(file => [file.sourceLayerId, file.relativePath]))
    const entries = selectOutputNavigation(state).entries.filter(entry => {
      const name = names.get(entry.id)
      return name !== undefined && normalize(name).includes(query)
    })
    if (!entries.length) return
    const index = findOutputNavigationIndex(entries, state.selectedOutputSourceId ?? state.selectedLayerId, state.selectedVirtualSetId)
    const next = direction === 'first' ? 0 : direction === 'last' ? entries.length - 1
      : index < 0 ? (direction > 0 ? 0 : entries.length - 1)
        : Math.max(0, Math.min(entries.length - 1, index + direction))
    select(entries[next].id)
  }, [query, select])

  useEffect(() => {
    const element = list.current
    if (!element) return
    const wheel = (event: WheelEvent) => {
      const delta = event.deltaY || event.deltaX
      if (!event.shiftKey || !delta) return
      event.preventDefault()
      move(delta > 0 ? 1 : -1)
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [move])

  useEffect(() => {
    if (active && selectedIndex >= 0) list.current?.children[selectedIndex]?.scrollIntoView?.({ block: 'nearest' })
  }, [active, selectedIndex, visible])

  return <>
    <div className={styles.listTools}>
      <input type="search" aria-label="出力ファイル名を検索" placeholder="ファイル名を検索" value={search}
        onChange={event => setSearch(event.target.value)} />
      <span className={styles.fileCount} aria-live="polite">{query ? `${visible.length} / ${files.length}` : files.length}件</span>
      <button type="button" className={styles.showTree} disabled={!selectedId} onClick={onShowTree}
        title="選択中の出力をツリーで表示" aria-label="選択中の出力をツリーで表示">↗</button>
    </div>
    <div ref={list} className={styles.fileList} role="listbox" tabIndex={0} aria-label="出力ファイル"
      aria-activedescendant={selectedIndex >= 0 ? `${id}-${selectedIndex}` : undefined}
      onKeyDown={event => {
        const direction = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1
          : event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : null
        if (direction !== null) { event.preventDefault(); move(direction) }
      }}>
      {visible.map((file, index) => <div key={file.sourceLayerId} id={`${id}-${index}`} role="option"
        aria-selected={file.sourceLayerId === selectedId} className={styles.fileRow}
        data-output-source-id={file.sourceLayerId} title={file.relativePath}
        onClick={() => { list.current?.focus(); select(file.sourceLayerId) }}>
        {file.relativePath}
      </div>)}
      {!visible.length && <div className={styles.empty}>{query ? '一致するファイルはありません' : '現在の設定で出力されるファイルはありません'}</div>}
    </div>
  </>
}
