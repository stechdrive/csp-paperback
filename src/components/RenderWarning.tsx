import { Tooltip } from './Tooltip'
import { ja } from '../i18n/ja'
import styles from './RenderWarning.module.css'

export function RenderWarning({ vector = false, unavailable = false, unsupported3D = false }: { vector?: boolean; unavailable?: boolean; unsupported3D?: boolean }) {
  const content = [
    vector && (unavailable ? '描画できないベクターレイヤーがあります。' : 'ベクターレイヤーを近似描画しています。'),
    vector && '線幅・濃さ・ブラシ形状などに差や欠落が生じる場合があります。',
    unsupported3D && ja.input.clip3dUnavailable,
    unsupported3D && ja.input.clip3dResave,
    unsupported3D && !vector ? ja.input.clip3dPsdFallback : 'クリスタと同じ出力が必要な場合は、同じ保存状態からクリスタで書き出したPSDを追加してください。',
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
