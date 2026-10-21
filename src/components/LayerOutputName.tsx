import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../store'
import { selectOutputAliasTargets } from '../store/selectors'
import { previewOutputAlias } from '../utils/output-alias-preview'
import type { CspLayer } from '../types'
import { Tooltip } from './Tooltip'
import styles from './LayerOutputName.module.css'

interface Props {
  layer: CspLayer
  className: string
  editing: boolean
  onEdit?: (id: string) => void
  onFinish?: (restoreFocus: boolean) => void
}

export function LayerOutputName({ layer, className, editing, onEdit, onFinish }: Props) {
  const eligible = useAppStore(s => selectOutputAliasTargets(s).has(layer.id))
  const alias = useAppStore(s => eligible ? s.outputAliases.get(layer.id) : undefined)
  const display = alias ?? (layer.autoMarked || layer.animationFolder?.detectedBy === 'autoProcess'
    ? layer.originalName : layer.name || layer.originalName)
  const tooltip = alias === undefined ? `${layer.originalName}${eligible ? '\nダブルクリックまたは F2 で出力名を指定' : ''}`
    : `出力名: ${alias}\n元の名前: ${layer.originalName}\nダブルクリックまたは F2 で編集`
  return <Tooltip content={tooltip} disabled={editing}>
    <span className={`${className} ${styles.slot}`} data-output-alias={alias === undefined ? undefined : 'true'}>
      <span className={`${styles.text} ${alias === undefined ? '' : styles.aliased}`} data-layer-name
        style={editing ? { visibility: 'hidden' } : undefined}
        onDoubleClick={eligible ? event => { event.stopPropagation(); onEdit?.(layer.id) } : undefined}>{display}</span>
      {editing && <OutputNameEditor layer={layer} initial={alias ?? layer.originalName} onFinish={onFinish!} />}
    </span>
  </Tooltip>
}

function OutputNameEditor({ layer, initial, onFinish }: { layer: CspLayer; initial: string; onFinish: (restoreFocus: boolean) => void }) {
  const [draft, setDraft] = useState(initial)
  const state = useAppStore()
  const documentAtStart = useRef(state.rawPsd)
  const input = useRef<HTMLInputElement>(null)
  const feedback = useRef<HTMLDivElement>(null)
  const composing = useRef(false), blurred = useRef(false), finished = useRef(false)
  const descriptionId = useId()
  const preview = useMemo(() => previewOutputAlias(state, layer.id, draft), [state, layer.id, draft])
  useLayoutEffect(() => { input.current?.focus({ preventScroll: true }); input.current?.select() }, [])
  useLayoutEffect(() => {
    const place = () => {
      const anchor = input.current, panel = feedback.current
      if (!anchor || !panel) return
      const rect = anchor.getBoundingClientRect()
      panel.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - panel.offsetWidth - 4))}px`
      panel.style.top = `${Math.max(4, rect.bottom + panel.offsetHeight + 6 < window.innerHeight ? rect.bottom + 4 : rect.top - panel.offsetHeight - 4)}px`
    }
    place()
    window.addEventListener('resize', place)
    document.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); document.removeEventListener('scroll', place, true) }
  }, [preview])
  const finish = (save: boolean, restoreFocus: boolean, value = draft) => {
    if (finished.current) return
    finished.current = true
    const current = useAppStore.getState()
    if (save && value.trim() && value !== initial && current.rawPsd === documentAtStart.current) current.setOutputAlias(layer.id, value)
    onFinish(restoreFocus)
  }
  return <>
    <input ref={input} className={styles.input} aria-label={`${layer.originalName}の出力名`} aria-describedby={descriptionId}
      aria-invalid={!!preview.error} value={draft} spellCheck={false} autoComplete="off"
      onChange={event => setDraft(event.target.value)}
      onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
      onDoubleClick={event => event.stopPropagation()} onDragStart={event => { event.preventDefault(); event.stopPropagation() }}
      onCompositionStart={() => { composing.current = true }}
      onCompositionEnd={event => {
        composing.current = false
        setDraft(event.currentTarget.value)
        if (blurred.current) finish(true, false, event.currentTarget.value)
      }}
      onBlur={() => { if (composing.current) blurred.current = true; else finish(true, false) }}
      onKeyDown={event => {
        event.stopPropagation()
        if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return
        if (event.key === 'Escape') { event.preventDefault(); finish(false, true) }
        if (event.key === 'Enter') { event.preventDefault(); if (!preview.error) finish(true, true) }
      }} />
    {createPortal(<div ref={feedback} className={styles.feedback} id={descriptionId} role="status" aria-label="出力名の確認">
      <strong>出力用の名前</strong><div>元の名前: {layer.originalName}</div>
      <div>Enter で確定 · Esc で取り消し</div>
      {preview.error && <p>{preview.error}</p>}
      {preview.notes.map(note => <p key={note}>{note}</p>)}
      {!!preview.names.length && <><div>現在の設定での出力例</div>{preview.names.map(name => <div className={styles.example} key={name}>{name}</div>)}
        {preview.count > 3 && <div>ほか {preview.count - 3} 件</div>}</>}
    </div>, document.body)}
  </>
}
