import { useImperativeHandle, useRef, type ComponentPropsWithRef, type CSSProperties, type MouseEventHandler, type ReactNode } from 'react'
import type { LayerDisplayMetadata } from '../types/layer-display'
import { Tooltip } from './Tooltip'
import { LayerIcon } from './LayerIcon'
import { layerKindLabels } from '../utils/layer-display'
import { LayerIndicators } from './LayerIndicators'
import { useLayerActions } from '../hooks/useLayerActions'
import { layerRoleLabel, type LayerOutputRole, type LayerAction } from '../utils/layer-row-state'
import styles from './LayerTree.module.css'

export type LayerItemKind = 'layer' | 'folder' | 'animation' | 'cell'
export interface LayerTreeRowControls {
  warning?: ReactNode
  actions: LayerAction[]
  select?: () => void
}

export function LayerVisibilityIcon() {
  return (
    <svg className={styles.visibilityIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.75 12C4.8 8.5 8.16 6.5 12 6.5C15.84 6.5 19.2 8.5 21.25 12C19.2 15.5 15.84 17.5 12 17.5C8.16 17.5 4.8 15.5 2.75 12Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.75" fill="currentColor" />
    </svg>
  )
}

export function LayerVisibility({ hidden, readOnly = false, unavailable, ...props }: {
  hidden: boolean
  readOnly?: boolean
  unavailable?: string
} & Omit<ComponentPropsWithRef<'button'>, 'hidden' | 'children' | 'className'>) {
  const className = `${styles.visibilityBtn} ${hidden ? styles.visibilityBtnHidden : styles.visibilityBtnVisible}`
  if (unavailable) return <span className={`${className} ${styles.visibilityReadOnly} ${styles.visibilityUnavailable}`}
    role="img" aria-label={unavailable} data-layer-column="visibility">—</span>
  if (readOnly) {
    return <span className={`${className} ${styles.visibilityReadOnly}`} role="img"
      aria-label={hidden ? '非表示' : '表示'} data-layer-column="visibility">
      {!hidden && <LayerVisibilityIcon />}
    </span>
  }
  return <button type="button" className={className} data-layer-column="visibility"
    aria-label={hidden ? 'レイヤーを表示する' : 'レイヤーを非表示にする'} aria-pressed={!hidden} {...props}>
    {!hidden && <LayerVisibilityIcon />}
  </button>
}

export function LayerExpandIcon({ expanded = false, transient = false }: { expanded?: boolean; transient?: boolean }) {
  return <svg className={[
    styles.expandChevron, expanded ? styles.expandChevronOpen : '', transient ? styles.expandChevronTransient : '',
  ].filter(Boolean).join(' ')} viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <path d="M3 2 L7 5 L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

function LayerTypeIcon({ kind, metadata }: { kind: LayerItemKind; metadata?: LayerDisplayMetadata }) {
  const contentKind = metadata?.kind ?? (kind === 'layer' ? 'raster' : 'folder')
  const label = kind === 'animation' ? 'アニメーションフォルダ'
    : kind === 'cell' ? `セル（${layerKindLabels[contentKind]}）` : layerKindLabels[contentKind]
  return <Tooltip content={label}><span className={`${styles.typeIcon} ${kind === 'cell' ? styles.typeIconCell : ''}`}
    role="img" aria-label={label} data-layer-icon={kind} data-layer-content-kind={contentKind}>
    <LayerIcon kind={kind === 'animation' ? 'animation' : contentKind} />
  </span></Tooltip>
}

function paletteIconColor(color: string): string {
  const [r, g, b] = [1, 3, 5].map(index => {
    const channel = parseInt(color.slice(index, index + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#000' : '#fff'
}

interface LayerTreeRowProps extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'hidden'> {
  name: string
  depth: number
  kind: LayerItemKind
  metadata?: LayerDisplayMetadata
  autoProcess?: boolean
  autoMarked?: boolean
  outputRole?: LayerOutputRole
  dimmed?: boolean
  selected?: boolean
  activeCell?: boolean
  dropTarget?: boolean
  example?: boolean
  expanded?: boolean
  transientExpanded?: boolean
  onExpand?: MouseEventHandler<HTMLButtonElement>
  visibility: ReactNode
  renderName?: (className: string) => ReactNode
  status?: ReactNode
  controls?: LayerTreeRowControls
}

/** Shared presentation only. Editing, drag/drop and example state belong to callers. */
export function LayerTreeRow({
  ref, name, depth, kind, metadata, autoProcess = false, autoMarked = false, outputRole, dimmed = false,
  selected = false, activeCell = false, dropTarget = false, example = false,
  expanded, transientExpanded = false, onExpand, visibility, renderName, status, controls,
  className = '', ...rowProps
}: LayerTreeRowProps) {
  const row = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => row.current!, [])
  const menu = useLayerActions(name, controls?.actions, row, controls?.select)
  const paletteColor = metadata?.paletteColor
  const nameClass = [styles.name,
    autoProcess ? styles.nameAnimAutoProcess : kind === 'animation' ? styles.nameAnim
      : autoMarked ? styles.nameAutoMark : kind === 'cell' ? styles.nameCell : '',
  ].filter(Boolean).join(' ')
  return <div {...rowProps} {...menu} ref={row}
    onPointerDown={event => { menu.onPointerDown(event); rowProps.onPointerDown?.(event) }}
    className={[
    styles.row, selected ? styles.rowSelected : '', activeCell ? styles.rowCellActive : '',
    dimmed ? styles.rowHidden : '', dropTarget ? styles.rowDropTarget : '',
    example ? styles.rowExample : '', className,
  ].filter(Boolean).join(' ')} data-layer-kind={kind}>
    <span className={styles.visibilityCell} data-palette-color={paletteColor} style={{
      backgroundColor: paletteColor,
      '--layer-palette-foreground': paletteColor ? paletteIconColor(paletteColor) : undefined,
    } as CSSProperties}>{visibility}</span>
    <div className={styles.identity} data-layer-column="name">
      <div className={styles.indent} style={{ '--layer-depth': depth } as CSSProperties} />
      {onExpand ? <Tooltip content={transientExpanded
        ? 'Shift+スクロール巡回で自動展開中\nクリックで閉じると元の閉じた状態に戻ります。次の巡回では必要な経路を再び開きます' : ''}>
        <button type="button" className={styles.expandBtn} onClick={onExpand}
          aria-label={`${name}を${expanded ? '折りたたむ' : '展開する'}`} aria-expanded={expanded}>
          <LayerExpandIcon expanded={expanded} transient={transientExpanded} />
        </button>
      </Tooltip> : <div className={styles.expandPlaceholder} />}
      <LayerTypeIcon kind={kind === 'animation' && outputRole?.kind === 'animation' ? 'folder' : kind}
        metadata={metadata} />
      <LayerIndicators metadata={metadata} />
      {outputRole && <Tooltip content={layerRoleLabel(outputRole)}><span role="img" aria-label={layerRoleLabel(outputRole)}
        className={`${styles.outputBadge} ${outputRole.kind === 'individual' ? styles.outputBadgeIndividual : autoProcess ? styles.typeIconAutoProcess : styles.outputBadgeAnimation}`}
        data-layer-output-role={outputRole.kind} data-output-origin={outputRole.origin}>
        <LayerIcon kind={outputRole.kind === 'individual' ? 'star' : 'animation'} />
      </span></Tooltip>}
      {renderName ? renderName(nameClass) : <span className={nameClass} data-layer-name>{name}</span>}
    </div>
    <div className={styles.statusColumns}>{status}</div>
    {controls?.warning &&
      <span className={styles.controlSlot} data-layer-column="warning">{controls.warning}</span>
    }
  </div>
}
