import { useState } from 'react'
import { useAppStore } from '../store'
import type { ClipDocument } from '../utils/clip/types'
import { Modal } from './Modal'
import styles from './ClipImportNotice.module.css'

/** Normal import only. Quick export presents the same diagnostics after all jobs. */
export function ClipImportNotice({ isLoading }: { isLoading: boolean }) {
  const clip = useAppStore(s => s.clipDocument)
  const diagnostics = useAppStore(s => s.clipDiagnostics)
  const [dismissed, setDismissed] = useState<ClipDocument | null>(null)
  const missing = diagnostics.filter(d => d.outcome === 'missing-content')
  if (isLoading || !clip || clip === dismissed || !missing.length) return null
  return <Modal className={styles.notice} label="描画画像を取得できないレイヤー" onClose={() => setDismissed(clip)}>
    <h2>描画画像を取得できないレイヤーがあります</h2>
    <p>書き出しは続けられます。該当レイヤーだけの出力も、指定した背景で画像を作成します。</p>
    <ul>{missing.map((d, i) => <li key={i}>{d.message}</li>)}</ul>
    <button type="button" onClick={() => setDismissed(clip)}>確認しました</button>
  </Modal>
}
