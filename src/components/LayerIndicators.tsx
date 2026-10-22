import type { CSSProperties } from 'react'
import type { LayerDisplayMetadata } from '../types/layer-display'
import { LayerIcon, type LayerIconKind } from './LayerIcon'
import { Tooltip } from './Tooltip'
import styles from './LayerTree.module.css'

export function LayerIndicators({ metadata }: { metadata?: LayerDisplayMetadata }) {
  const effects: { kind: LayerIconKind; label: string; style?: CSSProperties }[] = []
  const fx = metadata?.effects
  if (fx?.layerColor) effects.push({ kind: 'color', label: 'レイヤーカラー', style: {
    '--lc': `rgb(${fx.layerColor.main.join(' ')})`, '--lc-sub': `rgb(${fx.layerColor.sub.join(' ')})`,
  } as CSSProperties })
  if (fx?.edge) effects.push({ kind: 'edge', label: '境界効果（フチ）' })
  if (fx?.watercolor) effects.push({ kind: 'water', label: '境界効果（水彩境界）' })
  if (fx?.tone) effects.push({ kind: 'tone', label: 'トーン' })
  const mask = metadata?.mask
  return <span className={styles.indicators} data-layer-column="indicators">
    {effects.map((effect, index) => <Tooltip key={effect.kind} content={effect.label} toggleOnClick>
      <button type="button" className={`${styles.indicator} ${index >= 2 ? styles.extraEffect : ''}`} style={effect.style}
        aria-label={effect.label} data-layer-effect={effect.kind} onPointerDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}><LayerIcon kind={effect.kind} /></button>
    </Tooltip>)}
    {effects.length > 2 && <Tooltip content={effects.slice(2).map(effect => effect.label).join('\n')} toggleOnClick>
      <button type="button" className={styles.effectCount} aria-label={`その他の効果 ${effects.length - 2}件`}
        onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>+{effects.length - 2}</button>
    </Tooltip>}
    {mask && <Tooltip content={mask === 'disabled' ? 'マスク無効' : 'マスク有効'} toggleOnClick>
      <button type="button" className={styles.indicator} aria-label={mask === 'disabled' ? 'マスク無効' : 'マスク有効'}
        data-layer-mask={mask} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
        <LayerIcon kind={mask === 'disabled' ? 'maskoff' : 'mask'} />
      </button>
    </Tooltip>}
  </span>
}
