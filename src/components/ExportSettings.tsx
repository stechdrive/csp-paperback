import { useMemo } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import { Tooltip } from './Tooltip'
import { UnmatchedTracksWarning } from './UnmatchedTracksWarning'
import {
  resolveCellPrefixSeparator,
  resolveIncludeXdtsTrackPrefixInCellName,
  type CellNamingMode,
  type CellPrefixSeparator,
  type CspLayer,
} from '../types'
import { isAutoMarkedOutputTarget } from '../utils/auto-marked-container'
import { getMaxSequenceNumberForAnimationFolders } from '../engine/cell-extractor'
import type { OutputConfigTarget } from '../store/output-slice'
import {
  isSequenceNamingMode,
  makeCellFileName,
  makeCellLabel,
  resolveCellPrefixSeparatorCharacter,
  resolveSequenceDigits,
  resolveTrackPrefixMode,
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
  cellPrefixSeparator: CellPrefixSeparator,
  includeXdtsTrackPrefixInCellName: boolean,
): string {
  const trackName = 'A'
  const sampleCellName = mode === 'cellname' ? '1' : 'ア'
  const cellLabel = makeCellLabel(mode, sampleCellName, 1, sequenceDigits)
  const fileName = makeCellFileName({
    trackName,
    rawTrackName: trackName,
    cellLabel,
    processSuffix: '_e',
    processSuffixPosition,
    trackCellSeparator: resolveCellPrefixSeparatorCharacter(cellPrefixSeparator),
    trackPrefixMode: resolveTrackPrefixMode(
      mode,
      'xdts',
      includeXdtsTrackPrefixInCellName,
    ),
    suppressDuplicateProcessSuffix: mode === 'cellname',
  }).replace(/\.jpg$/i, `.${format}`)
  return structure === 'hierarchy' ? `${trackName}/${fileName}` : fileName
}

interface ExportSettingsProps {
  configTarget?: OutputConfigTarget
}

export function ExportSettings({ configTarget = 'current' }: ExportSettingsProps) {
  const outputConfig = useAppStore(s => (
    configTarget === 'quick' ? s.quickExportConfig : s.outputConfig
  ))
  const projectSettings = useAppStore(s => s.projectSettings)
  const layerTree = useAppStore(selectLayerTreeWithVisibility)
  const unmatchedTracks = useAppStore(s => s.unmatchedTracks)
  const setFormat = useAppStore(s => s.setFormat)
  const setBackground = useAppStore(s => s.setBackground)
  const setStructure = useAppStore(s => s.setStructure)
  const setProcessSuffixPosition = useAppStore(s => s.setProcessSuffixPosition)
  const setCellNamingMode = useAppStore(s => s.setCellNamingMode)
  const setSequenceDigitMode = useAppStore(s => s.setSequenceDigitMode)
  const setCellPrefixSeparator = useAppStore(s => s.setCellPrefixSeparator)
  const setIncludeXdtsTrackPrefixInCellName = useAppStore(
    s => s.setIncludeXdtsTrackPrefixInCellName,
  )
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
  const isCellNameMode = projectSettings.cellNamingMode === 'cellname'
  const cellPrefixSeparator = resolveCellPrefixSeparator(projectSettings)
  const includeXdtsTrackPrefixInCellName =
    resolveIncludeXdtsTrackPrefixInCellName(projectSettings)
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
    cellPrefixSeparator,
    includeXdtsTrackPrefixInCellName,
  )

  const handleAllOn = () => {
    setAllProcessSuffixExclusions([], configTarget)
    setExcludeAutoMarked(false, configTarget)
  }

  const handleAllOff = () => {
    setAllProcessSuffixExclusions(processSuffixes, configTarget)
    setExcludeAutoMarked(true, configTarget)
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
              onClick={() => setFormat('jpg', configTarget)}
            >JPG</button>
          </Tooltip>
          <Tooltip content={t.export.formatPngHint} placement="bottom">
            <button
              className={`${styles.toggle} ${outputConfig.format === 'png' ? styles.active : ''}`}
              onClick={() => setFormat('png', configTarget)}
            >PNG</button>
          </Tooltip>
        </div>

        <span className={styles.label}>{t.export.background}</span>
        <div className={styles.toggleGroup}>
          <Tooltip content={t.export.bgWhiteHint} placement="bottom">
            <button
              className={`${styles.toggle} ${outputConfig.background === 'white' ? styles.active : ''}`}
              onClick={() => setBackground('white', configTarget)}
            >{t.export.bgWhite}</button>
          </Tooltip>
          <Tooltip content={t.export.bgTransparentHint} placement="bottom">
            <button
              className={`${styles.toggle} ${outputConfig.background === 'transparent' ? styles.active : ''} ${outputConfig.format === 'jpg' ? styles.disabled : ''}`}
              onClick={() => {
                if (outputConfig.format === 'png') setBackground('transparent', configTarget)
              }}
              aria-disabled={outputConfig.format === 'jpg'}
            >{t.export.bgTransparent}</button>
          </Tooltip>
        </div>
      </div>

      <div className={styles.namingBlock} data-testid="naming-settings">
        <div className={styles.namingControls}>
          <div className={styles.inlineOption}>
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
          </div>

          <div className={styles.inlineOption}>
            <Tooltip
              content={isSequenceMode ? t.settings.sequenceDigitsHint : t.settings.sequenceOptionsUnavailableHint}
              placement="bottom"
            >
              <span className={styles.label}>{t.settings.sequenceDigits}</span>
            </Tooltip>
            <div className={styles.toggleGroup}>
              <Tooltip
                content={isSequenceMode ? t.settings.sequenceDigitsAutoHint : t.settings.sequenceOptionsUnavailableHint}
                placement="bottom"
              >
                <button
                  className={`${styles.toggle} ${(projectSettings.sequenceDigitMode ?? 'auto') === 'auto' ? styles.active : ''} ${!isSequenceMode ? styles.disabled : ''}`}
                  onClick={() => {
                    if (isSequenceMode) setSequenceDigitMode('auto')
                  }}
                  aria-disabled={!isSequenceMode}
                >{t.settings.sequenceDigitsAuto}</button>
              </Tooltip>
              <Tooltip
                content={isSequenceMode ? t.settings.sequenceDigitsFixed4Hint : t.settings.sequenceOptionsUnavailableHint}
                placement="bottom"
              >
                <button
                  className={`${styles.toggle} ${projectSettings.sequenceDigitMode === 'fixed-4' ? styles.active : ''} ${!isSequenceMode ? styles.disabled : ''}`}
                  onClick={() => {
                    if (isSequenceMode) setSequenceDigitMode('fixed-4')
                  }}
                  aria-disabled={!isSequenceMode}
                >{t.settings.sequenceDigitsFixed4}</button>
              </Tooltip>
            </div>
          </div>

          <div className={styles.inlineOption}>
            <Tooltip content={t.settings.cellPrefixSeparatorHint} placement="bottom">
              <span className={styles.label}>{t.settings.cellPrefixSeparator}</span>
            </Tooltip>
            <div className={styles.toggleGroup}>
              <Tooltip content={t.settings.cellPrefixSeparatorUnderscoreHint} placement="bottom">
                <button
                  className={`${styles.toggle} ${cellPrefixSeparator === 'underscore' ? styles.active : ''}`}
                  onClick={() => setCellPrefixSeparator('underscore')}
                >{t.settings.cellPrefixSeparatorUnderscore}</button>
              </Tooltip>
              <Tooltip content={t.settings.cellPrefixSeparatorNoneHint} placement="bottom">
                <button
                  className={`${styles.toggle} ${cellPrefixSeparator === 'none' ? styles.active : ''}`}
                  onClick={() => setCellPrefixSeparator('none')}
                >{t.settings.cellPrefixSeparatorNone}</button>
              </Tooltip>
            </div>
          </div>

          <div className={styles.inlineOption} data-testid="xdts-track-prefix-option">
            <Tooltip content={t.settings.xdtsTrackPrefixHint} placement="bottom">
              <span className={styles.label}>{t.settings.xdtsTrackPrefix}</span>
            </Tooltip>
            <Tooltip content={t.settings.xdtsTrackPrefixHint} placement="bottom">
              <label
                className={`${styles.inlineSwitchLabel} ${!isCellNameMode ? styles.disabledOption : ''}`}
              >
                <span
                  className={`${styles.switch} ${includeXdtsTrackPrefixInCellName ? styles.switchOn : ''}`}
                  onClick={() => {
                    if (isCellNameMode) {
                      setIncludeXdtsTrackPrefixInCellName(!includeXdtsTrackPrefixInCellName)
                    }
                  }}
                  role="switch"
                  aria-label={t.settings.xdtsTrackPrefix}
                  aria-checked={includeXdtsTrackPrefixInCellName}
                  aria-disabled={!isCellNameMode}
                />
                <span className={styles.switchValue}>
                  {includeXdtsTrackPrefixInCellName
                    ? t.settings.xdtsTrackPrefixOn
                    : t.settings.xdtsTrackPrefixOff}
                </span>
              </label>
            </Tooltip>
          </div>
        </div>

        <div className={styles.nameSampleRow} data-testid="name-sample-row">
          <span className={styles.label}>{t.export.outputNameSample}</span>
          <span className={styles.nameSample} title={nameSample}>{nameSample}</span>
        </div>
      </div>

      <div className={styles.switchGrid} data-testid="export-option-switch-grid">
        <div className={styles.switchItem} data-switch-option="shared-cut">
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
              <span className={styles.switchValue}>
                {projectSettings.sharedCutMode ? t.export.switchOn : t.export.switchOff}
              </span>
            </label>
          </Tooltip>
        </div>

        <div className={styles.switchItem} data-switch-option="structure">
          <Tooltip content={t.export.structureHint} placement="bottom">
            <label className={styles.switchLabel}>
              <span className={styles.label}>{t.export.structure}</span>
              <span
                className={`${styles.switch} ${outputConfig.structure === 'hierarchy' ? styles.switchOn : ''}`}
                onClick={() => setStructure(outputConfig.structure === 'hierarchy' ? 'flat' : 'hierarchy', configTarget)}
                role="switch"
                aria-label={t.export.structure}
                aria-checked={outputConfig.structure === 'hierarchy'}
              />
              <span className={styles.switchValue}>
                {outputConfig.structure === 'hierarchy' ? t.export.switchOn : t.export.switchOff}
              </span>
            </label>
          </Tooltip>
        </div>

        <div className={styles.switchItem} data-switch-option="process-position">
          <Tooltip content={t.export.processSuffixPositionHint} placement="bottom">
            <label className={styles.switchLabel}>
              <span className={styles.label}>{t.export.processSuffixPosition}</span>
              <span
                className={`${styles.switch} ${outputConfig.processSuffixPosition === 'before-cell' ? styles.switchOn : ''}`}
                onClick={() => setProcessSuffixPosition(outputConfig.processSuffixPosition === 'before-cell' ? 'after-cell' : 'before-cell', configTarget)}
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
        </div>

        <div className={styles.switchItem} data-switch-option="revision-border">
          <Tooltip content={t.export.revisionBorderHint} placement="bottom">
            <label className={styles.switchLabel}>
              <span className={styles.label}>{t.export.revisionBorder}</span>
              <span
                className={`${styles.switch} ${outputConfig.revisionBorderEnabled ? styles.switchOn : ''}`}
                onClick={() => setRevisionBorderEnabled(!outputConfig.revisionBorderEnabled, configTarget)}
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
                  onClick={() => toggleProcessSuffixExclusion(entry.suffix, configTarget)}
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
              onClick={() => setExcludeAutoMarked(!outputConfig.excludeAutoMarked, configTarget)}
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
