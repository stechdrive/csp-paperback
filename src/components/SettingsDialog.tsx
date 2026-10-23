import { useRef, useState } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { selectLayerTreeWithVisibility, selectProcessTableErrors } from '../store/selectors'
import {
  DEFAULT_PROJECT_SETTINGS,
  normalizeBodyGroupName,
  resolveCellPrefixSeparator,
  resolveIncludeXdtsTrackPrefixInCellName,
  type ProcessFolderEntry,
} from '../types'
import { APP_THEME_SWATCHES, type AppTheme } from '../theme'
import { pickSettingsJsonFile, saveTextFile, supportsNativeOpenDialog } from '../platform/files'
import styles from './SettingsDialog.module.css'
import { getMaxSequenceNumberForAnimationFolders } from '../engine/cell-extractor'
import {
  makeCellFileName,
  makeCellLabel,
  resolveCellPrefixSeparatorCharacter,
  resolveSequenceDigits,
  resolveTrackPrefixMode,
} from '../utils/naming'
import { resolveProcessBorderColor } from '../utils/process-color'
import { normalizeProcessTable } from '../utils/process-table'
import { ProcessColorPicker } from './ProcessColorPicker'
import { Modal } from './Modal'
import { processDisplayName } from '../utils/process-folder'
import { HelpDialog } from './HelpDialog'
import { Tooltip } from './Tooltip'
import { useDismissableLayer } from '../hooks/useDismissableLayer'

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
  const directoryExportMode = useAppStore(s => s.directoryExportMode)
  const setDirectoryExportMode = useAppStore(s => s.setDirectoryExportMode)
  const updateProcessTable = useAppStore(s => s.updateProcessTable)
  const setBodyGroupName = useAppStore(s => s.setBodyGroupName)
  const updateAutoMarkFolderNames = useAppStore(s => s.updateAutoMarkFolderNames)
  const updateArchivePatterns = useAppStore(s => s.updateArchivePatterns)
  const setShowIndividualFoldersOnLoad = useAppStore(s => s.setShowIndividualFoldersOnLoad)
  const importSettings = useAppStore(s => s.importSettings)
  const exportSettings = useAppStore(s => s.exportSettings)
  const setActiveTheme = useAppStore(s => s.setActiveTheme)
  const { t } = useLocale()
  const [importError, setImportError] = useState<string | null>(null)
  const [help, setHelp] = useState<'process' | 'templates' | null>(null)
  const [bodyNameDraft, setBodyNameDraft] = useState<string | null>(null)
  const bodyNameInput = useRef<HTMLInputElement>(null)
  const bodyGroupName = normalizeBodyGroupName(projectSettings.bodyGroupName)
  const commitBodyName = () => {
    if (bodyNameDraft !== null) setBodyGroupName(bodyNameDraft)
    setBodyNameDraft(null)
  }
  // The input consumes Escape before the modal's capture-phase dismissal handler.
  useDismissableLayer({ open: bodyNameDraft !== null, content: bodyNameInput, closeOnBlur: false,
    onDismiss: reason => { if (reason === 'escape') setBodyNameDraft(null) } })

  const [tableRows, setTableRows] = useState<ProcessFolderEntry[]>(
    normalizeProcessTable(projectSettings.processTable)
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
    projectSettings.cellNamingMode === 'cellname' ? '1' : 'ア',
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

  const handleDisplayNameChange = (i: number, displayName: string) => {
    const next = tableRows.map((row, index) => index === i ? { ...row, displayName } : row)
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
      displayName: '修正工程',
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
    commitBodyName()
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

  const applyImport = async (file: { text: () => Promise<string> }) => {
    try {
      importSettings(await file.text())
      const s = useAppStore.getState().projectSettings
      setBodyNameDraft(null)
      setTableRows(normalizeProcessTable(s.processTable))
      setAutoMarkRows(s.autoMarkFolderNames)
      setArchiveRows(s.archivePatterns)
      setImportError(null)
    } catch (error) {
      setImportError(`設定を読み込めませんでした: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleImport = async () => {
    if (supportsNativeOpenDialog()) {
      const file = await pickSettingsJsonFile()
      if (!file) return
      await applyImport(file)
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      await applyImport(file)
    }
    input.click()
  }

  const handleClose = () => {
    commitBodyName()
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
    <><Modal className={styles.overlay} label="書き出し詳細設定" onClose={handleClose}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <span className={styles.title}>{t.settings.title}</span>
          <button className={styles.closeBtn} onClick={handleClose}>✕</button>
        </div>

        <div className={styles.body}>
          <section className={styles.section} aria-labelledby="quick-export-save-heading">
            <div className={styles.sectionTitle} id="quick-export-save-heading">クイック書き出しの保存方法</div>
            <label><input type="radio" name="directory-export-mode" checked={directoryExportMode === 'subfolder'} onChange={() => setDirectoryExportMode('subfolder')} /> フォルダを作る</label>
            <label><input type="radio" name="directory-export-mode" checked={directoryExportMode === 'direct-flat'} onChange={() => setDirectoryExportMode('direct-flat')} /> 直接書き出す</label>
            <div className={styles.hint}>EXEやショートカットへCLIPをドロップしたときの保存方法を記憶します。直接書き出す場合は、階層を保持せずCLIPと同じフォルダへ画像をまとめます。同名画像がある場合は上書きを確認します。</div>
          </section>
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

          <section className={styles.section} aria-labelledby="body-group-heading">
            <div id="body-group-heading" className={styles.sectionTitle}>工程に属さないセル画像</div>
            <label className={styles.row}>
              <span className={styles.label}>グループ名</span>
              <input ref={bodyNameInput} className={`${styles.tableInput} ${styles.bodyNameInput}`}
                aria-label="工程に属さないセル画像のグループ名" aria-describedby="body-group-hint"
                maxLength={4096} value={bodyNameDraft ?? bodyGroupName}
                onFocus={() => setBodyNameDraft(bodyGroupName)}
                onChange={event => setBodyNameDraft(event.target.value)}
                onBlur={commitBodyName}
                onKeyDown={event => {
                  if (event.nativeEvent.isComposing || event.keyCode === 229) return
                  if (event.key === 'Enter') { event.preventDefault(); commitBodyName() }
                }} />
            </label>
            <div id="body-group-hint" className={styles.hint}>「出力対象」に表示する名前です。</div>
          </section>

          {/* 工程フォルダリスト */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t.settings.processTable}</div>
            <div className={styles.hint}>
              演出・作監などを、工程別の画像に分けるための設定です。
              素材内のフォルダ名と、書き出す画像名に付ける文字を対応づけます。
            </div>
            <div className={styles.processTableGrid} data-testid="process-table-grid">
              <div className={styles.tableHeader}>
                <ColumnHelp label={t.settings.colDisplayName} description="「出力対象」に表示する工程の名前です。フォルダの判定やファイル名には使いません。" />
                <ColumnHelp label={t.settings.colSuffix} description="セル画像のファイル名に付ける文字です。例：_e → A1_e.jpg。区切りの _ も含めて入力します。" />
                <ColumnHelp label={t.settings.colFolderNames} description="素材内でこの工程として扱うフォルダ名です。複数ある場合はカンマで区切ります。例：_e, 演出。" />
                <ColumnHelp label={t.settings.colBorderColor} description="「修正ラベル」がONのときに使う色です。クリックすると変更できます。" />
                <span>出力サンプル</span>
                <span></span>
              </div>
              {tableRows.map((row, i) => (
                <div key={i} className={styles.tableRow} data-process-table-row>
                  <input
                    className={`${styles.tableInput} ${styles.processNameInput}`}
                    aria-label={`${t.settings.colDisplayName} ${i + 1}`}
                    value={row.displayName ?? ''}
                    onChange={e => handleDisplayNameChange(i, e.target.value)}
                    placeholder={processDisplayName(row)}
                  />
                  <input
                    className={styles.tableInput}
                    aria-label={`出力名に付ける文字 ${i + 1}`}
                    value={row.suffix}
                    onChange={e => handleSuffixChange(i, e.target.value)}
                    placeholder="_en"
                  />
                  <input
                    className={styles.tableInput}
                    value={row.folderNames.join(', ')}
                    aria-label={`対応するフォルダ名 ${i + 1}`}
                    onChange={e => handleFolderNamesChange(i, e.target.value)}
                    placeholder="EN, 演出修正, ens"
                  />
                  <div className={styles.colorCell}>
                    <ProcessColorPicker
                      color={resolveProcessBorderColor(row)}
                      label={processDisplayName(row)}
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
                      trackCellSeparator: resolveCellPrefixSeparatorCharacter(
                        resolveCellPrefixSeparator(projectSettings),
                      ),
                      trackPrefixMode: resolveTrackPrefixMode(
                        projectSettings.cellNamingMode,
                        'xdts',
                        resolveIncludeXdtsTrackPrefixInCellName(projectSettings),
                      ),
                      suppressDuplicateProcessSuffix: projectSettings.cellNamingMode === 'cellname',
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
            <div className={styles.helpLinks}>
              <button type="button" onClick={() => setHelp('process')}>工程の分け方を見る</button>
              <button type="button" onClick={() => setHelp('templates')}>各社テンプレートの例を見る</button>
            </div>
          </div>

          {/* 個別書き出しの名前指定と読み込み時の表示 */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t.settings.autoMarkFolders}</div>
            <div className={styles.hint}>{t.settings.autoMarkFolderHint}</div>
            <label className={styles.radioLabel}>
              <input type="checkbox" checked={projectSettings.showIndividualFoldersOnLoad !== false}
                onChange={e => setShowIndividualFoldersOnLoad(e.target.checked)} />
              {t.settings.showIndividualFoldersOnLoad}
            </label>
            <div className={styles.hint}>{t.settings.showIndividualFoldersOnLoadHint}</div>
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

          {/* 名前による指定の除外リスト */}
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
          {importError && <div role="alert" className={styles.errorMsg}>{importError}</div>}
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
    </Modal>
      {help && <HelpDialog initialTab={help === 'process' ? 'features' : 'templates'}
        initialSection={help === 'process' ? 'process' : undefined} onClose={() => setHelp(null)} />}
    </>
  )
}

function ColumnHelp({ label, description }: { label: string; description: string }) {
  return <span><Tooltip content={description} toggleOnClick>
    <button type="button" className={styles.columnHelp} aria-label={`${label}の説明`}>
      {label} <span aria-hidden="true">ⓘ</span>
    </button>
  </Tooltip></span>
}
