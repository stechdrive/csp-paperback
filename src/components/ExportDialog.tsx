import { useAppStore } from '../store'
import { useExport } from '../hooks/useExport'
import styles from './ExportDialog.module.css'

interface ExportDialogProps {
  onClose: () => void
}

export function ExportDialog({ onClose }: ExportDialogProps) {
  const outputConfig = useAppStore(s => s.outputConfig)
  const setFormat = useAppStore(s => s.setFormat)
  const setBackground = useAppStore(s => s.setBackground)
  const setStructure = useAppStore(s => s.setStructure)
  const setScope = useAppStore(s => s.setScope)
  const setJpgQuality = useAppStore(s => s.setJpgQuality)

  const { isExporting, progress, error, startExport } = useExport()

  const handleExport = async () => {
    await startExport()
    if (!error) onClose()
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.dialog}>
        <div className={styles.title}>出力設定</div>

        {/* フォーマット */}
        <div className={styles.section}>
          <div className={styles.label}>フォーマット</div>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input type="radio" name="format" value="jpg"
                checked={outputConfig.format === 'jpg'}
                onChange={() => setFormat('jpg')} />
              JPG
            </label>
            <label className={styles.radioLabel}>
              <input type="radio" name="format" value="png"
                checked={outputConfig.format === 'png'}
                onChange={() => setFormat('png')} />
              PNG
            </label>
          </div>
          {outputConfig.format === 'jpg' && (
            <div className={styles.qualityRow}>
              <span className={styles.label}>品質</span>
              <input
                type="range" min={0.5} max={1} step={0.01}
                value={outputConfig.jpgQuality}
                className={styles.qualitySlider}
                onChange={e => setJpgQuality(parseFloat(e.target.value))}
              />
              <span className={styles.qualityValue}>
                {Math.round(outputConfig.jpgQuality * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* 背景 */}
        <div className={styles.section}>
          <div className={styles.label}>背景</div>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input type="radio" name="bg" value="white"
                checked={outputConfig.background === 'white'}
                onChange={() => setBackground('white')} />
              白ベタ
            </label>
            <label className={`${styles.radioLabel} ${outputConfig.format === 'jpg' ? styles.disabled : ''}`}>
              <input type="radio" name="bg" value="transparent"
                checked={outputConfig.background === 'transparent'}
                disabled={outputConfig.format === 'jpg'}
                onChange={() => setBackground('transparent')} />
              透明（PNG のみ）
            </label>
          </div>
        </div>

        {/* 出力構造 */}
        <div className={styles.section}>
          <div className={styles.label}>ファイル構造</div>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input type="radio" name="structure" value="hierarchy"
                checked={outputConfig.structure === 'hierarchy'}
                onChange={() => setStructure('hierarchy')} />
              階層保持
            </label>
            <label className={styles.radioLabel}>
              <input type="radio" name="structure" value="flat"
                checked={outputConfig.structure === 'flat'}
                onChange={() => setStructure('flat')} />
              フラット展開
            </label>
          </div>
        </div>

        {/* 出力スコープ */}
        <div className={styles.section}>
          <div className={styles.label}>出力対象</div>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input type="radio" name="scope" value="all"
                checked={outputConfig.scope === 'all'}
                onChange={() => setScope('all')} />
              全出力
            </label>
            <label className={styles.radioLabel}>
              <input type="radio" name="scope" value="marked"
                checked={outputConfig.scope === 'marked'}
                onChange={() => setScope('marked')} />
              マーク指定
            </label>
          </div>
        </div>

        {/* 進捗・エラー */}
        {isExporting && (
          <div className={styles.progress}>
            <div className={styles.progressBar} style={{ width: `${progress * 100}%` }} />
          </div>
        )}
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={isExporting}>
            キャンセル
          </button>
          <button className={styles.exportBtn} onClick={handleExport} disabled={isExporting}>
            {isExporting ? '出力中…' : 'ZIP 出力'}
          </button>
        </div>
      </div>
    </div>
  )
}
