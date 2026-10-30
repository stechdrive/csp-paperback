import { useAppStore } from '../store'
import { compatibilityAdvice } from '../utils/clip/rendering-status'
import { groupRenderIssues, type RenderIssue } from '../utils/render-diagnostics'
import { findLayerPath } from '../utils/layerNavigation'
import styles from './DiagnosticList.module.css'

/** Shared by document, output and individual-layer warning popovers. */
export function DiagnosticList({ issues, onInspect }: { issues: RenderIssue[]; onInspect: (layerId: string) => void }) {
  const tree = useAppStore(s => s.layerTree)
  const compatibility = useAppStore(s => s.clipDocument?.compatibility)
  const advice = issues.some(issue => issue.part === 'material' && issue.materialKind)
  const groups = groupRenderIssues(issues)
  return <>
    {advice && <aside className={styles.advice}>
      {compatibility === 'saved' ? <p>{compatibilityAdvice(compatibility)}</p> : <>
        <p>互換情報付きで保存すると、再現性を改善できる場合があります。</p>
        <details><summary>クリスタでの保存手順</summary><p>{compatibilityAdvice(compatibility)}</p></details>
      </>}
    </aside>}
    <ul className={styles.groups} aria-label="警告の種類">
      {groups.map(group => <li key={group.key}>
        <details open={group.issues.length === 1}>
          <summary><strong>{group.title}</strong>{group.issues.some(issue => issue.layerId) && <span>{group.issues.length}レイヤー</span>}</summary>
          {group.message !== group.title && <p>{group.message}</p>}
          <ul className={styles.layers}>
            {group.issues.filter(issue => issue.layerId).map(issue => {
              const path = findLayerPath(tree, issue.layerId)
              return <li key={issue.layerId}>
                <span>{path.map(layer => layer.originalName).join(' / ') || issue.layerName || issue.layerId}</span>
                {path.length > 0 && <button type="button" onClick={() => onInspect(issue.layerId)}>素材を確認</button>}
              </li>
            })}
          </ul>
        </details>
      </li>)}
    </ul>
  </>
}
