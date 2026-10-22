import type { ComponentPropsWithRef, CSSProperties, MouseEventHandler, ReactNode } from 'react'
import type { LayerDisplayMetadata } from '../types/layer-display'
import { Tooltip } from './Tooltip'
import { LayerIcon } from './LayerIcon'
import { layerKindLabels } from '../utils/layer-display'
import { LayerIndicators } from './LayerIndicators'
import { LayerActionsMenu } from './LayerActionsMenu'
import styles from './LayerTree.module.css'

export type LayerItemKind = 'layer' | 'folder' | 'animation' | 'cell'
export interface LayerTreeRowControls {
  warning?: ReactNode; animation?: ReactNode; individual?: ReactNode
  rename?: () => void
  individualActive?: boolean
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

export function LayerVisibility({ hidden, readOnly = false, ...props }: {
  hidden: boolean
  readOnly?: boolean
} & Omit<ComponentPropsWithRef<'button'>, 'hidden' | 'children' | 'className'>) {
  const className = `${styles.visibilityBtn} ${hidden ? styles.visibilityBtnHidden : styles.visibilityBtnVisible}`
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

function LayerTypeIcon({ kind, autoProcess, metadata }: { kind: LayerItemKind; autoProcess: boolean; metadata?: LayerDisplayMetadata }) {
  const contentKind = metadata?.kind ?? (kind === 'layer' ? 'raster' : 'folder')
  const label = kind === 'animation' ? 'アニメーションフォルダ'
    : kind === 'cell' ? `セル（${layerKindLabels[contentKind]}）` : layerKindLabels[contentKind]
  return <Tooltip content={label}><span className={`${styles.typeIcon} ${kind === 'cell' ? styles.typeIconCell : ''} ${autoProcess ? styles.typeIconAutoProcess : ''}`}
    role="img" aria-label={label} data-layer-icon={kind} data-layer-content-kind={contentKind}>
    <LayerIcon kind={kind === 'animation' ? 'animation' : contentKind} />
  </span></Tooltip>
}

interface LayerTreeRowProps extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'hidden'> {
  name: string
  depth: number
  kind: LayerItemKind
  metadata?: LayerDisplayMetadata
  autoProcess?: boolean
  autoMarked?: boolean
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
  name, depth, kind, metadata, autoProcess = false, autoMarked = false, dimmed = false,
  selected = false, activeCell = false, dropTarget = false, example = false,
  expanded, transientExpanded = false, onExpand, visibility, renderName, status, controls,
  className = '', ...rowProps
}: LayerTreeRowProps) {
  const nameClass = [styles.name,
    autoProcess ? styles.nameAnimAutoProcess : kind === 'animation' ? styles.nameAnim
      : autoMarked ? styles.nameAutoMark : kind === 'cell' ? styles.nameCell : '',
  ].filter(Boolean).join(' ')
  return <div {...rowProps} className={[
    styles.row, selected ? styles.rowSelected : '', activeCell ? styles.rowCellActive : '',
    dimmed ? styles.rowHidden : '', dropTarget ? styles.rowDropTarget : '',
    controls ? '' : styles.rowCompact, example ? styles.rowExample : '', className,
  ].filter(Boolean).join(' ')} data-layer-kind={kind}>
    {visibility}
    <Tooltip content={metadata?.paletteColor ? `パレットカラー ${metadata.paletteColor}` : undefined}>
      <span className={styles.paletteColor} data-layer-column="palette" data-palette-color={metadata?.paletteColor}
        style={{ backgroundColor: metadata?.paletteColor }} />
    </Tooltip>
    <div className={styles.identity} data-layer-column="name">
      <div className={styles.indent} style={{ '--layer-depth': depth } as CSSProperties} />
      {onExpand ? <Tooltip content={transientExpanded
        ? 'Shift+スクロール巡回で自動展開中\nクリックで閉じると元の閉じた状態に戻ります。次の巡回では必要な経路を再び開きます' : ''}>
        <button type="button" className={styles.expandBtn} onClick={onExpand}
          aria-label={`${name}を${expanded ? '折りたたむ' : '展開する'}`} aria-expanded={expanded}>
          <LayerExpandIcon expanded={expanded} transient={transientExpanded} />
        </button>
      </Tooltip> : <div className={styles.expandPlaceholder} />}
      <LayerTypeIcon kind={kind} autoProcess={autoProcess} metadata={metadata} />
      {renderName ? renderName(nameClass) : <span className={nameClass} data-layer-name>{name}</span>}
    </div>
    <LayerIndicators metadata={metadata} />
    <div className={styles.statusColumns}>{status}</div>
    {controls && <>
      <span className={styles.controlSlot} data-layer-column="warning">{controls.warning}</span>
      <span className={`${styles.controlSlot} ${styles.wideControl}`} data-layer-column="animation">{controls.animation}</span>
      <span className={`${styles.controlSlot} ${styles.wideControl}`} data-layer-column="individual">{controls.individual}</span>
      <span className={styles.actionsSlot} data-layer-column="actions">
        <LayerActionsMenu name={name} active={controls.individualActive} animation={controls.animation}
          individual={controls.individual} rename={controls.rename} />
      </span>
    </>}
  </div>
}
