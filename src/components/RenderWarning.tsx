import { Tooltip } from './Tooltip'
import { useAppStore } from '../store'
import { compatibilityAdvice, materialRenderingMessage } from '../utils/clip/rendering-status'
import styles from './RenderWarning.module.css'

export function RenderWarning({ vector = false, unavailable = false, unsupported3D = false, sourceIds }: { vector?: boolean; unavailable?: boolean; unsupported3D?: boolean; sourceIds?: Iterable<string> }) {
  const compatibility = useAppStore(s => s.clipDocument?.compatibility)
  const diagnostics = useAppStore(s => s.clipDiagnostics)
  const sources = new Set(sourceIds)
  const missingVector = unavailable || diagnostics.some(d => d.materialKind === 'vector' && d.outcome === 'missing-content' && d.layerId && sources.has(`clip:${d.layerId}`))
  const content = [
    vector && materialRenderingMessage('vector', missingVector),
    unsupported3D && materialRenderingMessage('3d', true),
    (vector || unsupported3D) && compatibilityAdvice(compatibility),
  ].filter(Boolean).join('\n')
  return <Tooltip content={content} toggleOnClick>
    <button type="button" className={styles.button} aria-label={vector ? 'ベクター描画の制限' : '3D描画の制限'}
      onPointerDown={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3 22 21H2Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M12 9v5m0 3v1" stroke="currentColor" strokeWidth="2"/></svg>
    </button>
  </Tooltip>
}
