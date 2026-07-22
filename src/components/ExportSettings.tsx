import { useMemo } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import { Tooltip } from './Tooltip'
import { UnmatchedTracksWarning } from './UnmatchedTracksWarning'
import type { CellNamingMode, CspLayer } from '../types'
import { isAutoMarkedOutputTarget } from '../utils/auto-marked-container'
import { getMaxSequenceNumberForAnimationFolders } from '../engine/cell-extractor'
import {
  isSequenceNamingMode,
  makeCellFileName,
  makeCellLabel,
  resolveAnimationSequenceSeparator,
  resolveSequenceDigits,
} from '../utils/naming'
import styles from './ExportSettings.module.css'

function collectAutoMarkedNames(layers: CspLayer[]): string[] {
  const names: string[] = []
  for (const l of layers) {
    if (isAutoMarkedOutputTarget(l)) names.push(l.originalName)
    if (l.isFolder && !l.isAnimationFolder) names.push(...collectAutoMarkedNames(l.children))
  }
  return names
}

function buildNameSample(
  mode: CellNamingMode,
  structure: 'hierarchy' | 'flat',
  processSuffixPosition: 'after-cell' | 'before-cell',
  format: 'jpg' | 'png',
  sequenceDigits: number,
  animationSequenceSeparator: 'underscore' | 'none',
): string {
  const trackName = 'A'
  const cellLabel = makeCellLabel(mode, 'ア', 1, sequenceDigits)
  const fileName = makeCellFileName({
    trackName,
    cellLabel,
    processSuffix: '_e',
    processSuffixPosition,
    trackCellSeparator: resolveAnimationSequenceSeparator(mode, animationSequenceSeparator),
    suppressDuplicateProcessSuffix: mode === 'cellname',
  }).replace(/\.jpg$/i, `.${format}`)
  return structure === 'hierarchy' ? `${trackName}/${fileName}` : fileName
}

export function ExportSettings() {
  const outputConfig = useAppStore(s => s.outputConfig)
  const projectSettings = useAppStore(s => s.projectSettings)
  const layerTree = useAppStore(selectLayerTreeWithVisibility)
  const unmatchedTracks = useAppStore(s => s.unmatchedTracks)
  const setFormat = useAppStore(s => s.setFormat)
  const setBackground = useAppStore(s => s.setBackground)
  const setStructure = useAppStore(s => s.setStructure)
  const setProcessSuffixPosition = useAppStore(s => s.setProcessSuffixPosition)
  const setCellNamingMode = useAppStore(s => s.setCellNamingMode)
  const setSequenceDigitMode = useAppStore(s => s.setSequenceDigitMode)
  const setAnimationSequenceSeparator = useAppStore(s => s.setAnimationSequenceSeparator)
  const setSharedCutMode = useAppStore(s => s.setSharedCutMode)
  const toggleProcessSuffixExclusion = useAppStore(s => s.toggleProcessSuffixExclusion)
  const setAllProcessSuffixExclusions = useAppStore(s => s.setAllProcessSuffixExclusions)
  const setExcludeAutoMarked = useAppStore(s => s.setExcludeAutoMarked)
  const setRevisionBorderEnabled = useAppStore(s => s.setRevisionBorderEnabled)
  const { t } = useLocale()

  const processSuffixes = projectSettings.processTable.map(e => e.suffix)

  const autoMarkedNames = useMemo(() => collectAutoMarkedNames(layerTree), [layerTree])
  const excludedSet = new Set(outputConfig.excludedProcessSuffixes)
  const allIncluded = processSuffixes.every(s => !excludedSet.has(s)) && !outputConfig.excludeAutoMarked
  const allExcluded = processSuffixes.every(s => excludedSet.has(s)) && outputConfig.excludeAutoMarked
  const isSequenceMode = isSequenceNamingMode(projectSettings.cellNamingMode)
  const sequenceDigits = resolveSequenceDigits(
    projectSettings.sequenceDigitMode ?? 'auto',
    getMaxSequenceNumberForAnimationFolders(layerTree),
  )
  const nameSample = buildNameSample(
    projectSettings.cellNamingMode,
    outputConfig.structure,
    outputConfig.processSuffixPosition,
    outputConfig.format,
    sequenceDigits,
    projectSettings.animationSequenceSeparator ?? 'underscore',
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
          <Tooltip content={t.export.formatJpgHint} placement="bottom">
            <button
              className={`${styles.toggle} ${outputConfig.format === 'jpg' ? styles.active : ''}`}
              onClick={() => setFormat('jpg')}
            >JPG</button>
          </Tooltip>
          <Tooltip content={t.export.formatPngHint} placement="bottom">
            <button
              className={`${styles.toggle} ${outputConfig.format === 'png' ? styles.active : ''}`}
              onClick={() => setFormat('png')}
            >PNG</button>
          </Tooltip>
        </div>

        <span className={styles.label}>{t.export.background}</span>
        <div className={styles.toggleGroup}>
          <Tooltip content={t.export.bgWhiteHint} placement="bottom">
            <button
              className={`${styles.toggle} ${outputConfig.background === 'white' ? styles.active : ''}`}
              onClick={() => setBackground('white')}
            >{t.export.bgWhite}</button>
          </Tooltip>
          <Tooltip content={t.export.bgTransparentHint} placement="bottom">
            <button
              className={`${styles.toggle} ${outputConfig.background === 'transparent' ? styles.active : ''} ${outputConfig.format === 'jpg' ? styles.disabled : ''}`}
              onClick={() => {
                if (outputConfig.format === 'png') setBackground('transparent')
              }}
              aria-disabled={outputConfig.format === 'jpg'}
            >{t.export.bgTransparent}</button>
          </Tooltip>
        </div>
      </div>

      <div className={styles.row}>
        <Tooltip content={t.settings.cellNamingHint} placement="bottom">
          <span className={styles.label}>{t.settings.cellNaming}</span>
        </Tooltip>
        <div className={styles.toggleGroup}>
          <Tooltip content={t.settings.cellNamingSequenceHint} placement="bottom">
            <button
              className={`${styles.toggle} ${projectSettings.cellNamingMode === 'sequence' ? styles.active : ''}`}
              onClick={() => setCellNamingMode('sequence')}
            >{t.settings.cellNamingSequence}</button>
          </Tooltip>
          <Tooltip content={t.settings.cellNamingSequenceCellnameHint} placement="bottom">
            <button
              className={`${styles.toggle} ${projectSettings.cellNamingMode === 'sequence-cellname' ? styles.active : ''}`}
              onClick={() => setCellNamingMode('sequence-cellname')}
            >{t.settings.cellNamingSequenceCellname}</button>
          </Tooltip>
          <Tooltip content={t.settings.cellNamingCellnameHint} placement="bottom">
            <button
              className={`${styles.toggle} ${projectSettings.cellNamingMode === 'cellname' ? styles.active : ''}`}
              onClick={() => setCellNamingMode('cellname')}
            >{t.settings.cellNamingCellname}</button>
          </Tooltip>
          <Tooltip content={t.settings.cellNamingSheetSequenceHint} placement="bottom">
            <button
              className={`${styles.toggle} ${projectSettings.cellNamingMode === 'sheet-sequence' ? styles.active : ''}`}
              onClick={() => setCellNamingMode('sheet-sequence')}
            >{t.settings.cellNamingSheetSequence}</button>
          </Tooltip>
        </div>
        <span className={styles.nameSample}>{nameSample}</span>

        {isSequenceMode && (
          <>
            <div className={styles.inlineOption}>
              <Tooltip content={t.settings.sequenceDigitsHint} placement="bottom">
                <span className={styles.label}>{t.settings.sequenceDigits}</span>
              </Tooltip>
              <div className={styles.toggleGroup}>
                <Tooltip content={t.settings.sequenceDigitsAutoHint} placement="bottom">
                  <button
                    className={`${styles.toggle} ${(projectSettings.sequenceDigitMode ?? 'auto') === 'auto' ? styles.active : ''}`}
                    onClick={() => setSequenceDigitMode('auto')}
                  >{t.settings.sequenceDigitsAuto}</button>
                </Tooltip>
                <Tooltip content={t.settings.sequenceDigitsFixed4Hint} placement="bottom">
                  <button
                    className={`${styles.toggle} ${projectSettings.sequenceDigitMode === 'fixed-4' ? styles.active : ''}`}
                    onClick={() => setSequenceDigitMode('fixed-4')}
                  >{t.settings.sequenceDigitsFixed4}</button>
                </Tooltip>
              </div>
            </div>

            <div className={styles.inlineOption}>
              <Tooltip content={t.settings.animationSequenceSeparatorHint} placement="bottom">
                <span className={styles.label}>{t.settings.animationSequenceSeparator}</span>
              </Tooltip>
              <div className={styles.toggleGroup}>
                <Tooltip content={t.settings.animationSequenceSeparatorUnderscoreHint} placement="bottom">
                  <button
                    className={`${styles.toggle} ${(projectSettings.animationSequenceSeparator ?? 'underscore') === 'underscore' ? styles.active : ''}`}
                    onClick={() => setAnimationSequenceSeparator('underscore')}
                  >{t.settings.animationSequenceSeparatorUnderscore}</button>
                </Tooltip>
                <Tooltip content={t.settings.animationSequenceSeparatorNoneHint} placement="bottom">
                  <button
                    className={`${styles.toggle} ${projectSettings.animationSequenceSeparator === 'none' ? styles.active : ''}`}
                    onClick={() => setAnimationSequenceSeparator('none')}
                  >{t.settings.animationSequenceSeparatorNone}</button>
                </Tooltip>
              </div>
            </div>
          </>
        )}

        <Tooltip content={t.export.sharedCutHint} placement="bottom">
          <label className={styles.switchLabel}>
            <span className={styles.label}>{t.export.sharedCut}</span>
            <span
              className={`${styles.switch} ${projectSettings.sharedCutMode ? styles.switchOn : ''}`}
              onClick={() => setSharedCutMode(!projectSettings.sharedCutMode)}
              role="switch"
              aria-label={t.export.sharedCut}
              aria-checked={!!projectSettings.sharedCutMode}
            />
          </label>
        </Tooltip>

        <Tooltip content={t.export.structureHint} placement="bottom">
          <label className={styles.switchLabel}>
            <span className={styles.label}>{t.export.structure}</span>
            <span
              className={`${styles.switch} ${outputConfig.structure === 'hierarchy' ? styles.switchOn : ''}`}
              onClick={() => setStructure(outputConfig.structure === 'hierarchy' ? 'flat' : 'hierarchy')}
              role="switch"
              aria-label={t.export.structure}
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
              aria-label={t.export.processSuffixPosition}
              aria-checked={outputConfig.processSuffixPosition === 'before-cell'}
            />
            <span className={styles.switchValue}>
              {outputConfig.processSuffixPosition === 'before-cell'
                ? t.export.processSuffixBeforeCell
                : t.export.processSuffixAfterCell}
            </span>
          </label>
        </Tooltip>

        <Tooltip content={t.export.revisionBorderHint} placement="bottom">
          <label className={styles.switchLabel}>
            <span className={styles.label}>{t.export.revisionBorder}</span>
            <span
              className={`${styles.switch} ${outputConfig.revisionBorderEnabled ? styles.switchOn : ''}`}
              onClick={() => setRevisionBorderEnabled(!outputConfig.revisionBorderEnabled)}
              role="switch"
              aria-label={t.export.revisionBorder}
              aria-checked={outputConfig.revisionBorderEnabled}
            />
            <span className={styles.switchValue}>
              {outputConfig.revisionBorderEnabled
                ? t.export.revisionBorderOn
                : t.export.revisionBorderOff}
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
        <Tooltip content={t.export.allOnHint} placement="bottom">
          <button
            className={`${styles.batchBtn} ${allIncluded ? styles.batchActive : ''}`}
            onClick={handleAllOn}
          >{t.export.allOn}</button>
        </Tooltip>
        <Tooltip content={t.export.allOffHint} placement="bottom">
          <button
            className={`${styles.batchBtn} ${allExcluded ? styles.batchActive : ''}`}
            onClick={handleAllOff}
          >{t.export.allOff}</button>
        </Tooltip>
      </div>
    </div>
  )
}
