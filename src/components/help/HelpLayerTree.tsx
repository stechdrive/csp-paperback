import { useState } from 'react'
import type { LayerDisplayMetadata } from '../../types/layer-display'
import { LayerTreeRow, LayerVisibility, type LayerItemKind, type LayerTreeRowControls } from '../LayerTreeRow'
import { LayerActionsProvider } from '../LayerActionsMenu'
import type { LayerOutputRole } from '../../utils/layer-row-state'
import styles from './HelpLayerTree.module.css'

export interface HelpLayer {
  id: string
  name: string
  kind: LayerItemKind
  metadata?: LayerDisplayMetadata
  children?: readonly HelpLayer[]
  hidden?: boolean
  autoMarked?: boolean
  outputRole?: LayerOutputRole
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
  const renderLayers = (items: readonly HelpLayer[], depth: number, parentHidden = false, insideAnimation = false) => (
    <ul className={styles.list}>
      {items.map(layer => {
        const expanded = !collapsed.has(layer.id)
        const hidden = parentHidden || !!layer.hidden
        return <li key={layer.id}>
          <div className={`${styles.entry} ${layer.output ? styles.entryOutput : ''} ${renderControls ? styles.entryInteractive : ''}`} data-help-layer={layer.id}>
            <LayerTreeRow name={layer.name} depth={depth} kind={layer.kind} autoMarked={!insideAnimation && layer.autoMarked}
              metadata={layer.metadata} outputRole={insideAnimation ? undefined : layer.outputRole ?? (layer.autoMarked ? { kind: 'individual', origin: 'automatic' } : undefined)}
              dimmed={hidden} expanded={expanded} example={!renderControls}
              selected={!!renderControls && selectedId === layer.id}
              onClick={renderControls ? () => setSelectedId(layer.id) : undefined}
              controls={renderControls ? { ...renderControls(layer), select: () => setSelectedId(layer.id) } : undefined}
              onExpand={layer.children?.length ? event => { event.stopPropagation(); toggle(layer.id) } : undefined}
              visibility={<LayerVisibility hidden={hidden} readOnly />} />
            {(layer.note || layer.output) && <div className={styles.annotation}>
              {layer.note && <span>{layer.note}</span>}
              {layer.output && <span className={styles.output}><span aria-hidden="true">→ </span><code>{layer.output}</code></span>}
            </div>}
          </div>
          {!!layer.children?.length && expanded && renderLayers(layer.children, depth + 1, hidden, insideAnimation || layer.kind === 'animation')}
        </li>
      })}
    </ul>
  )
  return <LayerActionsProvider><figure className={styles.figure} aria-label={label} data-help-example={exampleId}
    data-layer-tree-focus tabIndex={renderControls ? 0 : undefined} onKeyDown={event => {
      if (event.target !== event.currentTarget || !selectedId || !(event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10')) return
      event.preventDefault()
      const row = event.currentTarget.querySelector<HTMLElement>(`[data-help-layer="${CSS.escape(selectedId)}"] [data-layer-kind]`)
      const rect = row?.getBoundingClientRect()
      if (rect) row?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: rect.left + 20, clientY: rect.bottom }))
    }}>
    <figcaption className={styles.caption}>
      <strong>{label}</strong>
      <span>{caption ?? 'フォルダを開閉できます。上が前面、下が背面です。'}</span>
    </figcaption>
    {renderLayers(layers, 0)}
  </figure></LayerActionsProvider>
}
