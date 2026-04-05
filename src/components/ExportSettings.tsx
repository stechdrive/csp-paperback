import { useAppStore } from '../store'
import { useLocale } from '../i18n'
import styles from './ExportSettings.module.css'

export function ExportSettings() {
  const outputConfig = useAppStore(s => s.outputConfig)
  const projectSettings = useAppStore(s => s.projectSettings)
  const setFormat = useAppStore(s => s.setFormat)
  const setBackground = useAppStore(s => s.setBackground)
  const setStructure = useAppStore(s => s.setStructure)
  const setCellNamingMode = useAppStore(s => s.setCellNamingMode)
  const { t } = useLocale()

  return (
    <div className={styles.settings}>
      <div className={styles.row}>
        <span className={styles.label}>{t.export.format}</span>
        <div className={styles.toggleGroup}>
          <button
            className={`${styles.toggle} ${outputConfig.format === 'jpg' ? styles.active : ''}`}
            onClick={() => setFormat('jpg')}
          >JPG</button>
          <button
            className={`${styles.toggle} ${outputConfig.format === 'png' ? styles.active : ''}`}
            onClick={() => setFormat('png')}
          >PNG</button>
        </div>

        <span className={styles.label}>{t.export.background}</span>
        <div className={styles.toggleGroup}>
          <button
            className={`${styles.toggle} ${outputConfig.background === 'white' ? styles.active : ''}`}
            onClick={() => setBackground('white')}
          >{t.export.bgWhite}</button>
          <button
            className={`${styles.toggle} ${outputConfig.background === 'transparent' ? styles.active : ''} ${outputConfig.format === 'jpg' ? styles.disabled : ''}`}
            onClick={() => setBackground('transparent')}
            disabled={outputConfig.format === 'jpg'}
          >{t.export.bgTransparent}</button>
        </div>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>{t.settings.cellNaming}</span>
        <div className={styles.toggleGroup}>
          <button
            className={`${styles.toggle} ${projectSettings.cellNamingMode === 'sequence' ? styles.active : ''}`}
            onClick={() => setCellNamingMode('sequence')}
          >{t.settings.cellNamingSequence}</button>
          <button
            className={`${styles.toggle} ${projectSettings.cellNamingMode === 'cellname' ? styles.active : ''}`}
            onClick={() => setCellNamingMode('cellname')}
          >{t.settings.cellNamingCellname}</button>
        </div>

        <label className={styles.switchLabel}>
          <span className={styles.label}>{t.export.structure}</span>
          <span
            className={`${styles.switch} ${outputConfig.structure === 'hierarchy' ? styles.switchOn : ''}`}
            onClick={() => setStructure(outputConfig.structure === 'hierarchy' ? 'flat' : 'hierarchy')}
            role="switch"
            aria-checked={outputConfig.structure === 'hierarchy'}
          />
        </label>
      </div>
    </div>
  )
}
