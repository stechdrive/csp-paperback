import { useState } from 'react'
import { useExportConflict } from '../store/export-conflict'
import { Modal } from './Modal'
import type { ExportConflict, ExportConflictAnswer } from '../utils/directory-export-session'
import styles from './ExportConflictDialog.module.css'

function Confirmation({ conflict, answer }: { conflict: ExportConflict; answer: (value: ExportConflictAnswer) => void }) {
  const [applyToRemaining, setApplyToRemaining] = useState(false)
  const cancel = () => answer({ action: 'cancel' })
  return <Modal className={styles.overlay} label="同名画像の確認" onClose={cancel}>
    <div className={styles.panel} data-export-conflict>
      <h2>同名の画像が{conflict.overwriteCount}件あります。上書きしますか？</h2>
      <p className={styles.path}>{conflict.directory}</p>
      <p>上書き：{conflict.overwriteCount}件 ／ 新規追加：{conflict.newCount}件</p>
      <p className={styles.hint}>今回書き出さない画像や、ほかのファイルは残ります。</p>
      {conflict.allowApplyToRemaining && <label className={styles.remember}>
        <input type="checkbox" checked={applyToRemaining} onChange={event => setApplyToRemaining(event.target.checked)} />
        残りのカットにも適用
      </label>}
      <div className={styles.actions}>
        <button type="button" onClick={cancel}>キャンセル</button>
        <button type="button" onClick={() => answer({ action: 'rename', applyToRemaining })}>
          {conflict.mode === 'subfolder' ? '新しいフォルダに保存' : '別名で保存'}
        </button>
        <button type="button" className={styles.primary} onClick={() => answer({ action: 'overwrite', applyToRemaining })}>上書きする</button>
      </div>
    </div>
  </Modal>
}

export function ExportConflictDialog() {
  const pending = useExportConflict(s => s.pending)
  return pending ? <Confirmation {...pending} /> : null
}
