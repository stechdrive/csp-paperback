import { useMemo } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { Tooltip } from './Tooltip'
import { UnmatchedTracksWarning } from './UnmatchedTracksWarning'
import type { CspLayer } from '../types'
import styles from './ExportSettings.module.css'

function collectAutoMarkedNames(layers: CspLayer[]): string[] {
  const names: string[] = []
  for (const l of layers) {
    if (l.autoMarked && !l.singleMark) names.push(l.originalName)
    if (l.isFolder && !l.isAnimationFolder) names.push(...collectAutoMarkedNames(l.children))
  }
  return names
}

function buildNameSample(
  mode: 'sequence' | 'cellname',
  structure: 'hierarchy' | 'flat',
  processSuffixPosition: 'after-cell' | 'before-cell',
): string {
  const trackName = 'A'
  const cellLabel = mode === 'sequence' ? '0001' : 'ア'
  const processSuffix = '_e'
  const fileName = processSuffixPosition === 'before-cell'
    ? `${trackName}${processSuffix}_${cellLabel}.jpg`
    : `${trackName}_${cellLabel}${processSuffix}.jpg`
  return structure === 'hierarchy' ? `${trackName}/${fileName}` : fileName
}

export function ExportSettings() {
  const outputConfig = useAppStore(s => s.outputConfig)
  const projectSettings = useAppStore(s => s.projectSettings)
  const layerTree = useAppStore(s => s.layerTree)
  const unmatchedTracks = useAppStore(s => s.unmatchedTracks)
  const setFormat = useAppStore(s => s.setFormat)
  const setBackground = useAppStore(s => s.setBackground)
  const setStructure = useAppStore(s => s.setStructure)
  const setProcessSuffixPosition = useAppStore(s => s.setProcessSuffixPosition)
  const setCellNamingMode = useAppStore(s => s.setCellNamingMode)
  const toggleProcessSuffixExclusion = useAppStore(s => s.toggleProcessSuffixExclusion)
  const setAllProcessSuffixExclusions = useAppStore(s => s.setAllProcessSuffixExclusions)
  const setExcludeAutoMarked = useAppStore(s => s.setExcludeAutoMarked)
  const { t } = useLocale()

  const processSuffixes = projectSettings.processTable.map(e => e.suffix)

  const autoMarkedNames = useMemo(() => collectAutoMarkedNames(layerTree), [layerTree])
  const excludedSet = new Set(outputConfig.excludedProcessSuffixes)
  const allIncluded = processSuffixes.every(s => !excludedSet.has(s)) && !outputConfig.excludeAutoMarked
  const allExcluded = processSuffixes.every(s => excludedSet.has(s)) && outputConfig.excludeAutoMarked
  const nameSample = buildNameSample(
    projectSettings.cellNamingMode,
    outputConfig.structure,
    outputConfig.processSuffixPosition,
  )

  const handleAllOn = () => {
    setAllProcessSuffixExclusions([])
    setExcludeAutoMarked(false)
  }

  const handleAllOff = () => {
    setAllProcessSuffixExclusions(processSuffixes)
    setExcludeAutoMarked(true)
  }

  return (
    <div className={styles.settings}>
      {/* XDTS トラック不一致警告 (件数 > 0 のときだけ表示) */}
      <UnmatchedTracksWarning unmatchedTracks={unmatchedTracks} />
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
        <span className={styles.nameSample}>{nameSample}</span>

        <Tooltip content={t.export.structureHint} placement="bottom">
          <label className={styles.switchLabel}>
            <span className={styles.label}>{t.export.structure}</span>
            <span
              className={`${styles.switch} ${outputConfig.structure === 'hierarchy' ? styles.switchOn : ''}`}
              onClick={() => setStructure(outputConfig.structure === 'hierarchy' ? 'flat' : 'hierarchy')}
              role="switch"
              aria-checked={outputConfig.structure === 'hierarchy'}
            />
          </label>
        </Tooltip>

        <Tooltip content={t.export.processSuffixPositionHint} placement="bottom">
          <label className={styles.switchLabel}>
            <span className={styles.label}>{t.export.processSuffixPosition}</span>
            <span
              className={`${styles.switch} ${outputConfig.processSuffixPosition === 'before-cell' ? styles.switchOn : ''}`}
              onClick={() => setProcessSuffixPosition(outputConfig.processSuffixPosition === 'before-cell' ? 'after-cell' : 'before-cell')}
              role="switch"
              aria-checked={outputConfig.processSuffixPosition === 'before-cell'}
            />
            <span className={styles.switchValue}>
              {outputConfig.processSuffixPosition === 'before-cell'
                ? t.export.processSuffixBeforeCell
                : t.export.processSuffixAfterCell}
            </span>
          </label>
        </Tooltip>
      </div>

      <div className={styles.row}>
        <Tooltip content={t.export.outputTargetHint} placement="bottom">
          <span className={styles.label}>{t.export.outputTarget}</span>
        </Tooltip>
        <div className={styles.chipGroup}>
          {projectSettings.processTable.map(entry => {
            const tip = entry.folderNames.join(', ')
            return (
              <Tooltip key={entry.suffix} content={tip} placement="bottom">
                <button
                  className={`${styles.chip} ${!excludedSet.has(entry.suffix) ? styles.chipIncluded : ''}`}
                  onClick={() => toggleProcessSuffixExclusion(entry.suffix)}
                >{entry.suffix}</button>
              </Tooltip>
            )
          })}
          <Tooltip
            content={autoMarkedNames.length > 0 ? autoMarkedNames.join(', ') : t.export.autoMarkNone}
            placement="bottom"
          >
            <button
              className={`${styles.chip} ${!outputConfig.excludeAutoMarked ? styles.chipIncluded : ''}`}
              onClick={() => setExcludeAutoMarked(!outputConfig.excludeAutoMarked)}
            >{t.export.autoMark}</button>
          </Tooltip>
        </div>
        <button
          className={`${styles.batchBtn} ${allIncluded ? styles.batchActive : ''}`}
          onClick={handleAllOn}
        >{t.export.allOn}</button>
        <button
          className={`${styles.batchBtn} ${allExcluded ? styles.batchActive : ''}`}
          onClick={handleAllOff}
        >{t.export.allOff}</button>
      </div>
    </div>
  )
}
