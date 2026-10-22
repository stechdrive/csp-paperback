import type { MouseEventHandler } from 'react'
import { Tooltip } from './Tooltip'
import styles from './LayerTree.module.css'

interface ToggleProps {
  active: boolean
  onClick: MouseEventHandler<HTMLButtonElement>
}

export function LayerAnimationButton({ active, onClick }: ToggleProps) {
  const label = active
    ? '手動アニメーションフォルダ指定を解除する'
    : 'このフォルダを手動でアニメーションフォルダとして扱う'
  return <Tooltip content={label}>
    <button type="button" aria-label={label} aria-pressed={active}
      className={`${styles.animBtn} ${active ? styles.animBtnActive : ''}`} onClick={onClick}>🎬</button>
  </Tooltip>
}

export function LayerIndividualButton({ active, onClick }: ToggleProps) {
  const label = active ? 'この素材の個別書き出しを解除する' : 'この素材を別画像として書き出す'
  return <Tooltip content={active ? label : `${label}\nタイムライン登録なしでも出力される`}>
    <button type="button" aria-label={label} aria-pressed={active}
      className={`${styles.markBtn} ${active ? styles.markBtnActive : ''}`} onClick={onClick}>★</button>
  </Tooltip>
}
