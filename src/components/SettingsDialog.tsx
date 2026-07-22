import { useState } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { selectLayerTreeWithVisibility, selectProcessTableErrors } from '../store/selectors'
import type { ProcessFolderEntry } from '../types'
import { APP_THEME_SWATCHES, type AppTheme } from '../theme'
import { pickSettingsJsonFile, saveTextFile, supportsNativeOpenDialog } from '../platform/files'
import styles from './SettingsDialog.module.css'
import { DEFAULT_PROJECT_SETTINGS } from '../types'
import { getMaxSequenceNumberForAnimationFolders } from '../engine/cell-extractor'
import {
  makeCellFileName,
  makeCellLabel,
  resolveAnimationSequenceSeparator,
  resolveSequenceDigits,
} from '../utils/naming'
import { normalizeProcessTableColors, resolveProcessBorderColor } from '../utils/process-color'
import { ProcessColorPicker } from './ProcessColorPicker'

interface SettingsDialogProps {
  onClose: () => void
}

function cleanAutoMarkNames(rows: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const row of rows) {
    const trimmed = row.trim()
    const normalized = trimmed.toLowerCase()
    if (!trimmed || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(trimmed)
  }
  return result
}

function cleanPatterns(rows: string[]): string[] {
  return [...new Set(rows.map(row => row.trim()).filter(Boolean))]
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const projectSettings = useAppStore(s => s.projectSettings)
  const outputConfig = useAppStore(s => s.outputConfig)
  const layerTree = useAppStore(selectLayerTreeWithVisibility)
  const activeTheme = useAppStore(s => s.activeTheme)
  const updateProcessTable = useAppStore(s => s.updateProcessTable)
  const updateAutoMarkFolderNames = useAppStore(s => s.updateAutoMarkFolderNames)
  const updateArchivePatterns = useAppStore(s => s.updateArchivePatterns)
  const importSettings = useAppStore(s => s.importSettings)
  const exportSettings = useAppStore(s => s.exportSettings)
  const setActiveTheme = useAppStore(s => s.setActiveTheme)
  const { t } = useLocale()

  const [tableRows, setTableRows] = useState<ProcessFolderEntry[]>(
    normalizeProcessTableColors(projectSettings.processTable)
  )
  const [autoMarkRows, setAutoMarkRows] = useState<string[]>(
    projectSettings.autoMarkFolderNames ?? DEFAULT_PROJECT_SETTINGS.autoMarkFolderNames
  )
  const [archiveRows, setArchiveRows] = useState<string[]>(
    projectSettings.archivePatterns ?? DEFAULT_PROJECT_SETTINGS.archivePatterns
  )

  const errors = selectProcessTableErrors(useAppStore.getState())
  const sampleDigits = resolveSequenceDigits(
    projectSettings.sequenceDigitMode ?? 'auto',
    getMaxSequenceNumberForAnimationFolders(layerTree),
  )
  const sampleCellLabel = makeCellLabel(
    projectSettings.cellNamingMode,
    projectSettings.cellNamingMode === 'cellname' ? 'A1' : 'ア',
    1,
    sampleDigits,
  )
  const themeOptions: Array<{ value: AppTheme; label: string; description: string }> = [
    {
      value: 'midnight',
      label: t.settings.themeMidnight,
      description: t.settings.themeMidnightHint,
    },
    {
      value: 'graphite',
      label: t.settings.themeGraphite,
      description: t.settings.themeGraphiteHint,
    },
    {
      value: 'paper',
      label: t.settings.themePaper,
      description: t.settings.themePaperHint,
    },
  ]

  const handleSuffixChange = (i: number, value: string) => {
    const next = tableRows.map((r, idx) => idx === i ? { ...r, suffix: value } : r)
    setTableRows(next)
    updateProcessTable(next)
  }

  const handleFolderNamesChange = (i: number, value: string) => {
    const names = value.split(/[,、，]/).map(s => s.trim()).filter(Boolean)
    const next = tableRows.map((r, idx) => idx === i ? { ...r, folderNames: names } : r)
    setTableRows(next)
    updateProcessTable(next)
  }

  const handleBorderColorChange = (i: number, revisionBorderColor: string) => {
    const next = tableRows.map((row, idx) => idx === i
      ? { ...row, revisionBorderColor }
      : row)
    setTableRows(next)
    updateProcessTable(next)
  }

  const addRow = () => {
    const next = [...tableRows, {
      suffix: '',
      folderNames: [],
      revisionBorderColor: '#FBECE6',
    }]
    setTableRows(next)
    updateProcessTable(next)
  }

  const removeRow = (i: number) => {
    const next = tableRows.filter((_, idx) => idx !== i)
    setTableRows(next)
    updateProcessTable(next)
  }

  const handleExport = async () => {
    const json = exportSettings()
    try {
      await saveTextFile('csp-paperback-settings.json', json, 'JSON', ['json'])
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        window.alert(e instanceof Error ? e.message : '設定の書き出しに失敗しました')
      }
    }
  }

  const handleArchiveChange = (i: number, value: string) => {
    const next = archiveRows.map((p, idx) => idx === i ? value : p)
    setArchiveRows(next)
    updateArchivePatterns(next)
  }

  const addArchiveRow = () => {
    const next = [...archiveRows, '']
    setArchiveRows(next)
    updateArchivePatterns(next)
  }

  const removeArchiveRow = (i: number) => {
    const next = archiveRows.filter((_, idx) => idx !== i)
    setArchiveRows(next)
    updateArchivePatterns(next)
  }

  const handleAutoMarkChange = (i: number, value: string) => {
    const next = autoMarkRows.map((name, idx) => idx === i ? value : name)
    setAutoMarkRows(next)
    updateAutoMarkFolderNames(next)
  }

  const addAutoMarkRow = () => {
    const next = [...autoMarkRows, '']
    setAutoMarkRows(next)
    updateAutoMarkFolderNames(next)
  }

  const removeAutoMarkRow = (i: number) => {
    const next = autoMarkRows.filter((_, idx) => idx !== i)
    setAutoMarkRows(next)
    updateAutoMarkFolderNames(next)
  }

  const handleImport = async () => {
    if (supportsNativeOpenDialog()) {
      const file = await pickSettingsJsonFile()
      if (!file) return
      const text = await file.text()
      importSettings(text)
      const s = useAppStore.getState().projectSettings
      setTableRows(normalizeProcessTableColors(s.processTable))
      setAutoMarkRows(s.autoMarkFolderNames ?? DEFAULT_PROJECT_SETTINGS.autoMarkFolderNames)
      setArchiveRows(s.archivePatterns ?? DEFAULT_PROJECT_SETTINGS.archivePatterns)
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      importSettings(text)
      const s = useAppStore.getState().projectSettings
      setTableRows(normalizeProcessTableColors(s.processTable))
      setAutoMarkRows(s.autoMarkFolderNames ?? DEFAULT_PROJECT_SETTINGS.autoMarkFolderNames)
      setArchiveRows(s.archivePatterns ?? DEFAULT_PROJECT_SETTINGS.archivePatterns)
    }
    input.click()
  }

  const handleClose = () => {
    const cleaned = tableRows.filter(r => r.suffix.trim() || r.folderNames.length > 0)
    if (cleaned.length !== tableRows.length) {
      setTableRows(cleaned)
      updateProcessTable(cleaned)
    }
    const cleanedAutoMarkRows = cleanAutoMarkNames(autoMarkRows)
    if (JSON.stringify(cleanedAutoMarkRows) !== JSON.stringify(autoMarkRows)) {
      setAutoMarkRows(cleanedAutoMarkRows)
      updateAutoMarkFolderNames(cleanedAutoMarkRows)
    }
    const cleanedArchiveRows = cleanPatterns(archiveRows)
    if (JSON.stringify(cleanedArchiveRows) !== JSON.stringify(archiveRows)) {
      setArchiveRows(cleanedArchiveRows)
      updateArchivePatterns(cleanedArchiveRows)
    }
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <span className={styles.title}>{t.settings.title}</span>
          <button className={styles.closeBtn} onClick={handleClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t.settings.theme}</div>
            <div className={styles.hint}>{t.settings.themeHint}</div>
            <div className={styles.themeGrid}>
              {themeOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.themeCard} ${activeTheme === option.value ? styles.themeCardActive : ''}`}
                  onClick={() => setActiveTheme(option.value)}
                  aria-pressed={activeTheme === option.value}
                >
                  <span className={styles.themeSwatches} aria-hidden="true">
                    {APP_THEME_SWATCHES[option.value].map((color, index) => (
                      <span
                        key={`${option.value}-${index}`}
                        className={styles.themeSwatch}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                  <span className={styles.themeName}>{option.label}</span>
                  <span className={styles.themeDescription}>{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 工程フォルダリスト */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t.settings.processTable}</div>
            <div className={styles.processTableGrid} data-testid="process-table-grid">
              <div className={styles.tableHeader}>
                <span>{t.settings.colSuffix}</span>
                <span>{t.settings.colFolderNames}</span>
                <span>{t.settings.colBorderColor}</span>
                <span>出力サンプル</span>
                <span></span>
              </div>
              {tableRows.map((row, i) => (
                <div key={i} className={styles.tableRow} data-process-table-row>
                  <input
                    className={styles.tableInput}
                    value={row.suffix}
                    onChange={e => handleSuffixChange(i, e.target.value)}
                    placeholder="_en"
                  />
                  <input
                    className={styles.tableInput}
                    value={row.folderNames.join(', ')}
                    onChange={e => handleFolderNamesChange(i, e.target.value)}
                    placeholder="EN, 演出修正, ens"
                  />
                  <div className={styles.colorCell}>
                    <ProcessColorPicker
                      color={resolveProcessBorderColor(row)}
                      label={
                        row.folderNames.find(name => name.trim() && !name.trim().startsWith('_'))
                        || row.folderNames.find(Boolean)
                        || row.suffix
                        || `工程${i + 1}`
                      }
                      onChange={color => handleBorderColorChange(i, color)}
                    />
                    <code>{resolveProcessBorderColor(row).slice(1)}</code>
                  </div>
                  <span className={styles.sampleLabel}>
                    {makeCellFileName({
                      trackName: 'A',
                      rawTrackName: 'A',
                      cellLabel: sampleCellLabel,
                      processSuffix: row.suffix,
                      processSuffixPosition: outputConfig.processSuffixPosition,
                      trackCellSeparator: resolveAnimationSequenceSeparator(
                        projectSettings.cellNamingMode,
                        projectSettings.animationSequenceSeparator ?? 'underscore',
                      ),
                      suppressDuplicateProcessSuffix: projectSettings.cellNamingMode === 'cellname',
                      suppressDuplicateTrackPrefix: projectSettings.cellNamingMode === 'cellname',
                    }).replace(/\.jpg$/i, `.${outputConfig.format}`)}
                  </span>
                  <button className={styles.removeRowBtn} onClick={() => removeRow(i)}>✕</button>
                </div>
              ))}
            </div>
            {errors.size > 0 && (
              <div className={styles.errorMsg}>
                {t.settings.duplicateError}{[...errors].join(', ')}
              </div>
            )}
            <button className={styles.addRowBtn} onClick={addRow}>{t.settings.addRow}</button>
          </div>

          {/* 単体出力の自動マーク */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t.settings.autoMarkFolders}</div>
            <div className={styles.hint}>{t.settings.autoMarkFolderHint}</div>
            {autoMarkRows.map((name, i) => (
              <div key={i} className={styles.patternRow}>
                <input
                  className={styles.tableInput}
                  value={name}
                  onChange={e => handleAutoMarkChange(i, e.target.value)}
                  placeholder={t.settings.autoMarkFolderPlaceholder}
                />
                <button className={styles.removeRowBtn} onClick={() => removeAutoMarkRow(i)}>✕</button>
              </div>
            ))}
            <button className={styles.addRowBtn} onClick={addAutoMarkRow}>{t.settings.addPattern}</button>
            <div className={styles.hint}>{t.settings.autoMarkReloadHint}</div>
          </div>

          {/* 自動マークの除外リスト */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t.settings.archivePatterns}</div>
            <div className={styles.hint}>{t.settings.archivePatternHint}</div>
            {archiveRows.map((pattern, i) => (
              <div key={i} className={styles.patternRow}>
                <input
                  className={styles.tableInput}
                  value={pattern}
                  onChange={e => handleArchiveChange(i, e.target.value)}
                  placeholder={t.settings.archivePatternPlaceholder}
                />
                <button className={styles.removeRowBtn} onClick={() => removeArchiveRow(i)}>✕</button>
              </div>
            ))}
            <button className={styles.addRowBtn} onClick={addArchiveRow}>{t.settings.addPattern}</button>
          </div>

          {/* JSON import/export */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t.settings.shareSettings}</div>
            <div className={styles.hint}>{t.settings.shareSettingsHint}</div>
            <div className={styles.ioRow}>
              <button className={styles.ioBtn} onClick={() => void handleExport()}>{t.settings.exportJson}</button>
              <button className={styles.ioBtn} onClick={() => void handleImport()}>{t.settings.importJson}</button>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.doneBtn} onClick={handleClose}>{t.settings.done}</button>
        </div>
      </div>
    </div>
  )
}
