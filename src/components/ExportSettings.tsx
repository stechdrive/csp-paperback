import { useAppStore } from '../store'
import { useLocale } from '../i18n'
import styles from './ExportSettings.module.css'

export function ExportSettings() {
  const outputConfig = useAppStore(s => s.outputConfig)
  const setFormat = useAppStore(s => s.setFormat)
  const setBackground = useAppStore(s => s.setBackground)
  const setStructure = useAppStore(s => s.setStructure)
  const setScope = useAppStore(s => s.setScope)
  const setJpgQuality = useAppStore(s => s.setJpgQuality)
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

        <span className={styles.label}>{t.export.structure}</span>
        <div className={styles.toggleGroup}>
          <button
            className={`${styles.toggle} ${outputConfig.structure === 'hierarchy' ? styles.active : ''}`}
            onClick={() => setStructure('hierarchy')}
          >{t.export.structureHierarchy}</button>
          <button
            className={`${styles.toggle} ${outputConfig.structure === 'flat' ? styles.active : ''}`}
            onClick={() => setStructure('flat')}
          >{t.export.structureFlat}</button>
        </div>
      </div>

      <div className={styles.row}>
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

        <span className={styles.label}>{t.export.scope}</span>
        <div className={styles.toggleGroup}>
          <button
            className={`${styles.toggle} ${outputConfig.scope === 'all' ? styles.active : ''}`}
            onClick={() => setScope('all')}
          >{t.export.scopeAll}</button>
          <button
            className={`${styles.toggle} ${outputConfig.scope === 'marked' ? styles.active : ''}`}
            onClick={() => setScope('marked')}
          >{t.export.scopeMarked}</button>
        </div>
      </div>

      {outputConfig.format === 'jpg' && (
        <div className={styles.row}>
          <span className={styles.label}>{t.export.quality}</span>
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
  )
}
