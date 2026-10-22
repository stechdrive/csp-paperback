import { useState } from 'react'
import { LayerTreeRow, LayerVisibility, type LayerItemKind, type LayerTreeRowControls } from '../LayerTreeRow'
import styles from './HelpLayerTree.module.css'

export interface HelpLayer {
  id: string
  name: string
  kind: LayerItemKind
  children?: readonly HelpLayer[]
  hidden?: boolean
  autoMarked?: boolean
  note?: string
  output?: string
}

/** Small, explicit examples: no document store, parser or artwork is loaded here. */
export function HelpLayerTree({ label, layers, exampleId, caption, renderControls }: {
  label: string
  layers: readonly HelpLayer[]
  exampleId?: string
  caption?: string
  renderControls?: (layer: HelpLayer) => LayerTreeRowControls
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [selectedId, setSelectedId] = useState(() => renderControls ? layers[0]?.id : undefined)
  const toggle = (id: string) => setCollapsed(previous => {
    const next = new Set(previous)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const renderLayers = (items: readonly HelpLayer[], depth: number, parentHidden = false) => (
    <ul className={styles.list}>
      {items.map(layer => {
        const expanded = !collapsed.has(layer.id)
        const hidden = parentHidden || !!layer.hidden
        return <li key={layer.id}>
          <div className={`${styles.entry} ${layer.output ? styles.entryOutput : ''} ${renderControls ? styles.entryInteractive : ''}`} data-help-layer={layer.id}>
            <LayerTreeRow name={layer.name} depth={depth} kind={layer.kind} autoMarked={layer.autoMarked}
              dimmed={hidden} expanded={expanded} example={!renderControls}
              selected={!!renderControls && selectedId === layer.id}
              onClick={renderControls ? () => setSelectedId(layer.id) : undefined}
              controls={renderControls?.(layer)}
              onExpand={layer.children?.length ? event => { event.stopPropagation(); toggle(layer.id) } : undefined}
              visibility={<LayerVisibility hidden={hidden} readOnly />} />
            {(layer.note || layer.output) && <div className={styles.annotation}>
              {layer.note && <span>{layer.note}</span>}
              {layer.output && <span className={styles.output}><span aria-hidden="true">→ </span><code>{layer.output}</code></span>}
            </div>}
          </div>
          {!!layer.children?.length && expanded && renderLayers(layer.children, depth + 1, hidden)}
        </li>
      })}
    </ul>
  )
  return <figure className={styles.figure} aria-label={label} data-help-example={exampleId}>
    <figcaption className={styles.caption}>
      <strong>{label}</strong>
      <span>{caption ?? 'フォルダを開閉できます。上が前面、下が背面です。'}</span>
    </figcaption>
    {renderLayers(layers, 0)}
  </figure>
}
