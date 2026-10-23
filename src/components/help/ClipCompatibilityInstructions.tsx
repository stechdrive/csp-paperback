import { ja } from '../../i18n/ja'
import styles from './ClipCompatibilityInstructions.module.css'

export function ClipCompatibilityInstructions({ compact = false }: { compact?: boolean }) {
  const text = ja.input.clipCompatibility

  return (
    <div className={`${styles.instructions}${compact ? ` ${styles.compact}` : ''}`}>
      <strong>ベクターレイヤー・3Dレイヤーの描画をクリスタに合わせるには</strong>
      {!compact && <>
        <p>{text.setting}</p>
        <p>{text.initialSave}</p>
      </>}
      <p><strong>{text.afterEnabling}</strong></p>
      <p>{text.saveAs}{text.overwrite}</p>
      {!compact && <p>{text.reload}</p>}
    </div>
  )
}
