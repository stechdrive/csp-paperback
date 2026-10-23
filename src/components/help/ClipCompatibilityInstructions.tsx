import { ja } from '../../i18n/ja'
import styles from './ClipCompatibilityInstructions.module.css'

export function ClipCompatibilityInstructions({ compact = false }: { compact?: boolean }) {
  const text = ja.input.clipCompatibility

  return (
    <div className={`${styles.instructions}${compact ? ` ${styles.compact}` : ''}`}>
      <strong>ベクター・3Dの描画をクリスタに合わせるには</strong>
      <p>クリスタの［環境設定］→［ファイル］で、<strong>［バージョン互換情報の保存］を［保存する］にして、CLIPを保存してください。</strong></p>
      <p>保存済みのCLIPで後からONにした場合は、<strong>［ファイル］→［別名で保存］</strong>を使ってください。{text.overwrite}</p>
      {!compact && <>
        <p>{text.initialSave}</p>
        <p>{text.reload}</p>
      </>}
      <p>※後からONにした場合、通常の［保存］（Ctrl+S）だけでは互換情報は反映されません。</p>
    </div>
  )
}
