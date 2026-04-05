import { useAppStore } from '../store'
import { useExport } from '../hooks/useExport'
import { useLocale } from '../i18n'
import styles from './ExportDialog.module.css'

interface ExportDialogProps {
  onClose: () => void
}

export function ExportDialog({ onClose }: ExportDialogProps) {
  const outputConfig = useAppStore(s => s.outputConfig)
  const setFormat = useAppStore(s => s.setFormat)
  const setBackground = useAppStore(s => s.setBackground)
  const setStructure = useAppStore(s => s.setStructure)
  // const setJpgQuality = useAppStore(s => s.setJpgQuality)  // JPG品質UI復活時に有効化
  const { t } = useLocale()

  const { isExporting, progress, error, startExport } = useExport()

  const handleExport = async () => {
    await startExport()
    if (!error) onClose()
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.dialog}>
        <div className={styles.title}>{t.export.title}</div>

        {/* フォーマット */}
        <div className={styles.section}>
          <div className={styles.label}>{t.export.format}</div>
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
          {/* JPG品質スライダー: 現在UIから非表示（setJpgQuality / outputConfig.jpgQuality は維持） */}
        </div>

        {/* 背景 */}
        <div className={styles.section}>
          <div className={styles.label}>{t.export.background}</div>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input type="radio" name="bg" value="white"
                checked={outputConfig.background === 'white'}
                onChange={() => setBackground('white')} />
              {t.export.bgWhite}
            </label>
            <label className={`${styles.radioLabel} ${outputConfig.format === 'jpg' ? styles.disabled : ''}`}>
              <input type="radio" name="bg" value="transparent"
                checked={outputConfig.background === 'transparent'}
                disabled={outputConfig.format === 'jpg'}
                onChange={() => setBackground('transparent')} />
              {t.export.bgTransparent}
            </label>
          </div>
        </div>

        {/* 出力構造 */}
        <div className={styles.section}>
          <label className={styles.switchRow}>
            <span className={styles.label}>{t.export.structure}</span>
            <span
              className={`${styles.switch} ${outputConfig.structure === 'hierarchy' ? styles.switchOn : ''}`}
              onClick={() => setStructure(outputConfig.structure === 'hierarchy' ? 'flat' : 'hierarchy')}
              role="switch"
              aria-checked={outputConfig.structure === 'hierarchy'}
            />
          </label>
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
            {t.export.cancel}
          </button>
          <button className={styles.exportBtn} onClick={handleExport} disabled={isExporting}>
            {isExporting ? t.export.exporting : t.export.exportZip}
          </button>
        </div>
      </div>
    </div>
  )
}
