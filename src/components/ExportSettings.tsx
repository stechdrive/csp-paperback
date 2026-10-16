import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import { Tooltip } from './Tooltip'
import { UnmatchedTracksWarning } from './UnmatchedTracksWarning'
import { resolveCellPrefixSeparator, resolveIncludeXdtsTrackPrefixInCellName } from '../types'
import { OutputTargetControls } from './OutputTargetControls'
import { getMaxSequenceNumberForAnimationFolders } from '../engine/cell-extractor'
import type { OutputConfigTarget } from '../store/output-slice'
import { normalizeProcessFolderName } from '../utils/process-folder'
import { resolveProcessBorderColor } from '../utils/process-color'
import {
  isSequenceNamingMode, makeCellFileNameParts, makeCellLabel,
  resolveCellPrefixSeparatorCharacter, resolveSequenceDigits, resolveTrackPrefixMode,
  type CellFileNamePart,
} from '../utils/naming'
import styles from './ExportSettings.module.css'

type NamePart = CellFileNamePart['kind'] | 'directory'

function Choice<T extends string>({ label, value, options, disabled, onChange, avoidRef }: {
  label: string
  value: T
  options: { value: T; label: string; hint: string }[]
  disabled?: boolean
  onChange: (value: T) => void
  avoidRef: RefObject<HTMLDivElement | null>
}) {
  return <div className={styles.toggleGroup} role="group" aria-label={label}>
    {options.map(option => <Tooltip key={option.value} content={option.hint} avoidRef={avoidRef}>
      <button type="button" className={styles.toggle} aria-pressed={value === option.value}
        aria-disabled={disabled} onClick={() => { if (!disabled) onChange(option.value) }}>
        {option.label}
      </button>
    </Tooltip>)}
  </div>
}

function CheckOption({ label, hint, checked, disabled, onChange, children, avoidRef }: {
  label: string; hint: string; checked: boolean; disabled?: boolean
  onChange: (checked: boolean) => void; children?: ReactNode
  avoidRef: RefObject<HTMLDivElement | null>
}) {
  return <Tooltip content={hint} avoidRef={avoidRef}>
    <label className={styles.checkOption}>
      <input type="checkbox" role="switch" aria-label={label} checked={checked}
        aria-checked={checked} aria-disabled={disabled} disabled={disabled}
        onChange={event => { if (!disabled) onChange(event.target.checked) }} />
      <span>{label}</span>{children}
    </label>
  </Tooltip>
}

export function ExportSettings({ configTarget = 'current' }: { configTarget?: OutputConfigTarget }) {
  const outputConfig = useAppStore(s => configTarget === 'saved' ? s.savedOutputConfig : s.outputConfig)
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
  const setIncludeXdtsTrackPrefixInCellName = useAppStore(s => s.setIncludeXdtsTrackPrefixInCellName)
  const setSharedCutMode = useAppStore(s => s.setSharedCutMode)
  const setRevisionBorderEnabled = useAppStore(s => s.setRevisionBorderEnabled)
  const { t } = useLocale()
  const root = useRef<HTMLDivElement>(null)
  const nameSampleRef = useRef<HTMLDivElement>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hoveredElement = useRef<HTMLElement | null>(null)
  const [changedPart, setChangedPart] = useState<NamePart | null>(null)
  const [hoveredPart, setHoveredPart] = useState<NamePart | null>(null)
  const [focusedPart, setFocusedPart] = useState<NamePart | null>(null)
  const highlighted = hoveredPart ?? focusedPart ?? changedPart

  useEffect(() => () => clearTimeout(highlightTimer.current), [])
  const trackHoverElement = useCallback((element: HTMLElement | null) => {
    if (!element) return
    // Removing a preview part does not dispatch pointerleave.
    return () => {
      if (hoveredElement.current !== element) return
      hoveredElement.current = null
      setHoveredPart(null)
    }
  }, [])

  const maxSequenceNumber = useMemo(() => getMaxSequenceNumberForAnimationFolders(layerTree), [layerTree])
  const isSequenceMode = isSequenceNamingMode(projectSettings.cellNamingMode)
  const isCellNameMode = projectSettings.cellNamingMode === 'cellname'
  const separator = resolveCellPrefixSeparator(projectSettings)
  const includePrefix = resolveIncludeXdtsTrackPrefixInCellName(projectSettings)
  const sequenceDigits = resolveSequenceDigits(projectSettings.sequenceDigitMode ?? 'auto', maxSequenceNumber)
  const parts: { kind: NamePart; text: string }[] = [
    { kind: 'directory', text: outputConfig.structure === 'hierarchy' ? 'A/' : '' },
    ...makeCellFileNameParts({
      trackName: 'A', rawTrackName: 'A',
      cellLabel: makeCellLabel(projectSettings.cellNamingMode, isCellNameMode ? '1' : 'ア', 1, sequenceDigits),
      processSuffix: '_e', processSuffixPosition: outputConfig.processSuffixPosition,
      trackCellSeparator: resolveCellPrefixSeparatorCharacter(separator),
      trackPrefixMode: resolveTrackPrefixMode(projectSettings.cellNamingMode, 'clip', includePrefix),
      suppressDuplicateProcessSuffix: isCellNameMode,
    }).map(part => part.kind === 'extension' ? { ...part, text: `.${outputConfig.format}` } : part),
  ]
  const nameSample = parts.map(part => part.text).join('')
  const partLabels: Record<NamePart, string> = {
    directory: t.export.structure, prefix: t.settings.xdtsTrackPrefix,
    separator: t.settings.cellPrefixSeparator, cell: t.settings.cellNaming,
    suffix: t.export.processSuffixPosition, extension: t.export.format,
  }
  const revisionEntry = projectSettings.processTable.find(entry => entry.folderNames.some(name => normalizeProcessFolderName(name) === '作監'))
    ?? projectSettings.processTable.find(entry => entry.suffix.trim().toLowerCase() === '_s')
  const revisionColor = resolveProcessBorderColor(revisionEntry ?? { suffix: '_s', folderNames: [] })

  function change(part: NamePart, update: () => void) {
    update()
    flashPart(part)
  }

  function flashPart(part: NamePart) {
    clearTimeout(highlightTimer.current)
    setChangedPart(part)
    highlightTimer.current = setTimeout(() => setChangedPart(null), 1200)
  }

  function clearHighlight() {
    clearTimeout(highlightTimer.current)
    hoveredElement.current = null
    setChangedPart(null)
    setHoveredPart(null)
    setFocusedPart(null)
  }

  function linkPart(part: NamePart) {
    return {
      ref: trackHoverElement,
      'data-highlighted': highlighted === part,
      onPointerEnter: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === 'mouse') {
          hoveredElement.current = event.currentTarget
          setHoveredPart(part)
        }
      },
      onPointerLeave: (event: PointerEvent<HTMLElement>) => {
        if (hoveredElement.current !== event.currentTarget) return
        hoveredElement.current = null
        setHoveredPart(null)
      },
      onFocus: (event: FocusEvent<HTMLElement>) => {
        if (event.target.matches(':focus-visible')) setFocusedPart(part)
      },
      onBlur: () => setFocusedPart(null),
    }
  }

  function linkControl(part: NamePart) {
    return {
      'data-name-control': part,
      ...linkPart(part),
    }
  }

  function focusControl(part: NamePart) {
    flashPart(part)
    root.current?.querySelector<HTMLElement>(`[data-name-control="${part}"] input:not(:disabled), [data-name-control="${part}"] button[aria-pressed="true"]:not([aria-disabled="true"])`)?.focus()
  }

  return <div ref={root} className={styles.settings} data-testid="export-settings"
    onPointerDownCapture={() => setFocusedPart(null)}
    onKeyDownCapture={event => { if (event.key === 'Escape') clearHighlight() }}>
    <UnmatchedTracksWarning unmatchedTracks={unmatchedTracks} />
    <section className={styles.section} aria-label={t.export.imageSettings}>
      <span className={styles.sectionLabel}>{t.export.imageSettings}</span>
      <div className={styles.row}>
        <div className={styles.inlineOption} {...linkControl('extension')}>
          <span className={styles.label}>{t.export.format}</span>
          <Choice avoidRef={nameSampleRef} label={t.export.format} value={outputConfig.format} onChange={value => change('extension', () => setFormat(value, configTarget))} options={[
            { value: 'jpg', label: 'JPG', hint: t.export.formatJpgHint },
            { value: 'png', label: 'PNG', hint: t.export.formatPngHint },
          ]} />
        </div>
        <div className={styles.inlineOption}>
          <span className={styles.label}>{t.export.background}</span>
          <div className={styles.toggleGroup} role="group" aria-label={t.export.background}>
            <Tooltip content={t.export.bgWhiteHint} avoidRef={nameSampleRef}>
              <button type="button" className={styles.toggle} aria-pressed={outputConfig.background === 'white'} onClick={() => setBackground('white', configTarget)}>{t.export.bgWhite}</button>
            </Tooltip>
            <Tooltip content={t.export.bgTransparentHint} avoidRef={nameSampleRef}>
              <button type="button" className={styles.toggle} aria-label={t.export.bgTransparent} aria-pressed={outputConfig.background === 'transparent'} aria-disabled={outputConfig.format === 'jpg'}
                onClick={() => { if (outputConfig.format === 'png') setBackground('transparent', configTarget) }}>{t.export.bgTransparentShort}</button>
            </Tooltip>
          </div>
        </div>
        <CheckOption avoidRef={nameSampleRef} label={t.export.revisionBorder} hint={t.export.revisionBorderHint} checked={outputConfig.revisionBorderEnabled}
          onChange={value => setRevisionBorderEnabled(value, configTarget)}>
          <span className={styles.revisionSample} aria-hidden="true" data-testid="revision-label-sample" data-enabled={outputConfig.revisionBorderEnabled}
            style={{ '--revision-color': revisionColor } as CSSProperties} />
        </CheckOption>
      </div>
    </section>

    <section className={styles.section} aria-label={t.export.fileNameSettings} data-testid="naming-settings">
      <span className={styles.sectionLabel}>{t.export.fileNameSettings}</span>
      <div className={styles.content}>
        <div className={styles.row}>
          <div className={styles.inlineOption} {...linkControl('cell')}>
            <Tooltip content={t.settings.cellNamingHint} avoidRef={nameSampleRef}><span className={styles.label}>{t.settings.cellNaming}</span></Tooltip>
            <Choice avoidRef={nameSampleRef} label={t.settings.cellNaming} value={projectSettings.cellNamingMode} onChange={value => change('cell', () => setCellNamingMode(value))} options={[
              { value: 'sequence', label: t.settings.cellNamingSequence, hint: t.settings.cellNamingSequenceHint },
              { value: 'sequence-cellname', label: t.settings.cellNamingSequenceCellname, hint: t.settings.cellNamingSequenceCellnameHint },
              { value: 'cellname', label: t.settings.cellNamingCellname, hint: t.settings.cellNamingCellnameHint },
              { value: 'sheet-sequence', label: t.settings.cellNamingSheetSequence, hint: t.settings.cellNamingSheetSequenceHint },
            ]} />
          </div>
          <div className={styles.inlineOption} {...linkControl('cell')}>
            <Tooltip content={isSequenceMode ? t.settings.sequenceDigitsHint : t.settings.sequenceOptionsUnavailableHint} avoidRef={nameSampleRef}><span className={styles.label}>{t.settings.sequenceDigits}</span></Tooltip>
            <Choice avoidRef={nameSampleRef} label={t.settings.sequenceDigits} value={projectSettings.sequenceDigitMode ?? 'auto'} disabled={!isSequenceMode}
              onChange={value => change('cell', () => setSequenceDigitMode(value))} options={[
                { value: 'auto', label: t.settings.sequenceDigitsAuto, hint: isSequenceMode ? t.settings.sequenceDigitsAutoHint : t.settings.sequenceOptionsUnavailableHint },
                { value: 'fixed-4', label: t.settings.sequenceDigitsFixed4, hint: isSequenceMode ? t.settings.sequenceDigitsFixed4Hint : t.settings.sequenceOptionsUnavailableHint },
              ]} />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.inlineOption} data-testid="xdts-track-prefix-option" {...linkControl('prefix')}>
            <CheckOption avoidRef={nameSampleRef} label={t.settings.xdtsTrackPrefix} hint={t.settings.xdtsTrackPrefixHint} checked={includePrefix} disabled={!isCellNameMode}
              onChange={value => change('prefix', () => setIncludeXdtsTrackPrefixInCellName(value))} />
          </div>
          <div className={styles.inlineOption} {...linkControl('separator')}>
            <Tooltip content={t.settings.cellPrefixSeparatorHint} avoidRef={nameSampleRef}><span className={styles.label}>{t.settings.cellPrefixSeparatorShort}</span></Tooltip>
            <Choice avoidRef={nameSampleRef} label={t.settings.cellPrefixSeparator} value={separator} onChange={value => change('separator', () => setCellPrefixSeparator(value))} options={[
              { value: 'underscore', label: t.settings.cellPrefixSeparatorUnderscore, hint: t.settings.cellPrefixSeparatorUnderscoreHint },
              { value: 'none', label: t.settings.cellPrefixSeparatorNone, hint: t.settings.cellPrefixSeparatorNoneHint },
            ]} />
          </div>
          <div className={styles.inlineOption} {...linkControl('suffix')}>
            <Tooltip content={t.export.processSuffixPositionHint} avoidRef={nameSampleRef}><span className={styles.label}>{t.export.processSuffixShort}</span></Tooltip>
            <Choice avoidRef={nameSampleRef} label={t.export.processSuffixPosition} value={outputConfig.processSuffixPosition}
              onChange={value => change('suffix', () => setProcessSuffixPosition(value, configTarget))} options={[
                { value: 'before-cell', label: t.export.processSuffixBeforeCell, hint: t.export.processSuffixPositionHint },
                { value: 'after-cell', label: t.export.processSuffixAfterCell, hint: t.export.processSuffixPositionHint },
              ]} />
          </div>
          <div className={styles.inlineOption} {...linkControl('directory')}>
            <CheckOption avoidRef={nameSampleRef} label={t.export.structure} hint={t.export.structureHint} checked={outputConfig.structure === 'hierarchy'}
              onChange={value => change('directory', () => setStructure(value ? 'hierarchy' : 'flat', configTarget))} />
          </div>
        </div>
        <div ref={nameSampleRef} className={styles.nameSampleRow} data-testid="name-sample-row">
          <span className={styles.label}>{t.export.outputNameSample}</span>
          <output className={styles.nameSample} aria-label={`${t.export.outputNameSample}: ${nameSample}`} aria-live="polite">
            {parts.map(part => part.text ? <button type="button" key={part.kind} className={styles.namePart} data-name-part={part.kind} {...linkPart(part.kind)}
              aria-label={`${partLabels[part.kind]}: ${part.text}`} onClick={() => focusControl(part.kind)}>{part.text}</button>
              : <span key={part.kind} className={styles.emptyPart} data-name-part={part.kind} data-highlighted={highlighted === part.kind} aria-hidden="true" />)}
          </output>
        </div>
      </div>
    </section>

    <section className={styles.section} aria-label={t.export.outputTarget}>
      <Tooltip content={t.export.outputTargetHint} avoidRef={nameSampleRef}><span className={styles.sectionLabel}>{t.export.outputTarget}</span></Tooltip>
      <div className={styles.row}>
        <OutputTargetControls configTarget={configTarget} avoidRef={nameSampleRef} />
        <CheckOption avoidRef={nameSampleRef} label={t.export.sharedCut} hint={t.export.sharedCutHint} checked={!!projectSettings.sharedCutMode} onChange={setSharedCutMode} />
      </div>
    </section>
  </div>
}
