import { useId, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { CspLayer } from '../types'
import { useAppStore } from '../store'
import { findLayerPath } from '../utils/layerNavigation'
import { renderIssues, type RenderIssue } from '../utils/render-diagnostics'
import { materialRevision, subscribeMaterials } from '../engine/material-cache'
import { useDismissableLayer } from '../hooks/useDismissableLayer'
import styles from './RenderWarning.module.css'

export function DiagnosticWarning({ issues = [], error, onRetry }: {
  issues?: RenderIssue[]; error?: string; onRetry?: () => void
}) {
  const tree = useAppStore(s => s.layerTree)
  const button = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const id = useId()
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null)
  const dismiss = () => { setPosition(null); button.current?.focus({ preventScroll: true }) }
  useDismissableLayer({ open: !!position, content: popup, trigger: button, initialFocus: () => close.current,
    closeOnScroll: true, closeOnResize: true, onDismiss: reason => { setPosition(null); if (reason === 'escape') button.current?.focus() } })
  if (!issues.length && !error) return null
  return <>
    <button ref={button} type="button" className={styles.button} aria-label={error ? '描画エラーの詳細' : `描画の警告 ${issues.length}件`}
      aria-expanded={!!position} aria-haspopup="dialog" aria-controls={position ? id : undefined}
      onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}
      onDoubleClick={event => event.stopPropagation()}
      onClick={event => {
        event.stopPropagation()
        const rect = event.currentTarget.getBoundingClientRect()
        const above = Math.max(0, rect.top - 12), below = Math.max(0, window.innerHeight - rect.bottom - 12)
        // Keep the trigger available for a second click, including long lists
        // near the bottom of the screen. Scroll the details in the available space.
        setPosition(position ? null : { left: Math.max(8, Math.min(rect.left, window.innerWidth - 428)),
          ...(below >= Math.min(480, above)
            ? { top: rect.bottom + 4, maxHeight: Math.min(480, below) }
            : { bottom: window.innerHeight - rect.top + 4, maxHeight: Math.min(480, above) }) })
      }}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3 22 21H2Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M12 9v5m0 3v1" stroke="currentColor" strokeWidth="2"/></svg>
    </button>
    {position && createPortal(<div ref={popup} id={id} role="dialog" aria-label="描画の警告" className={styles.popup}
      style={position}
      onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <header><strong>{error ? '画像を作成できませんでした' : `この描画に関係する警告 · ${issues.length}件`}</strong>
        <button ref={close} type="button" aria-label="警告を閉じる" onClick={dismiss}>✕</button></header>
      {error && <p>{error}</p>}
      {onRetry && <button type="button" onClick={() => { dismiss(); onRetry() }}>再試行</button>}
      <ul>{issues.map((issue, index) => <li key={`${issue.layerId}:${index}`}>
        <strong>{findLayerPath(tree, issue.layerId).map(layer => layer.originalName).join(' / ') || issue.layerName}</strong>
        <p>{issue.message}</p>
        <button type="button" onClick={() => { dismiss(); useAppStore.getState().openQuickLook(issue.layerId) }}>素材を確認</button>
      </li>)}</ul>
    </div>, document.body)}
  </>
}

/** A folder only gets its own diagnostics; descendants are never rolled up. */
export function LayerDiagnosticWarning({ layer }: { layer: CspLayer }) {
  const diagnostics = useAppStore(s => s.clipDiagnostics)
  useSyncExternalStore(subscribeMaterials, materialRevision)
  return <DiagnosticWarning issues={renderIssues([layer], diagnostics)} />
}
