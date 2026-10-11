import { useAppStore } from '../store'
import styles from './ClipSourceStatus.module.css'

export function ClipSourceStatus() {
  const clip = useAppStore(s => s.clipDocument)
  const psdName = useAppStore(s => s.psdFileName)
  const timelineId = useAppStore(s => s.clipTimelineId)
  const selectTimeline = useAppStore(s => s.selectClipTimeline)
  const diagnostics = useAppStore(s => s.clipDiagnostics)
  if (!clip) return null
  return <div className={styles.status} data-testid="clip-source-status">
    <strong>{psdName ? 'PSDの画像を使用・タイムラインはCLIP' : 'CLIPから読み込み'}</strong>
    <p>{psdName
      ? 'CLIPのセル対応と設定を保持しています。'
      : 'クリスタの描画結果を使用する場合は、同じ保存状態から書き出したレイヤー付きPSDを追加できます。'}</p>
    {clip.timelines.length > 1 && <label>タイムライン
      <select value={timelineId ?? ''} onChange={e => selectTimeline(Number(e.target.value))}>
        {clip.timelines.map(t => <option key={t.id} value={t.id}>{t.data.timeTableName || `タイムライン ${t.id}`}</option>)}
      </select>
    </label>}
    {diagnostics.length > 0 && <details className={styles.warning}>
      <summary role="status">再現状況 {diagnostics.length} 件</summary>
      <ul>{diagnostics.map((d, index) => <li key={index}>{d.message}</li>)}</ul>
    </details>}
  </div>
}
