import { useState } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { selectProcessTableErrors } from '../store/selectors'
import type { ProcessFolderEntry } from '../types'
import styles from './SettingsDialog.module.css'
import { DEFAULT_PROJECT_SETTINGS } from '../types'

interface SettingsDialogProps {
  onClose: () => void
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const projectSettings = useAppStore(s => s.projectSettings)
  const updateProcessTable = useAppStore(s => s.updateProcessTable)
  const updateArchivePatterns = useAppStore(s => s.updateArchivePatterns)
  const importSettings = useAppStore(s => s.importSettings)
  const exportSettings = useAppStore(s => s.exportSettings)
  const { t } = useLocale()

  const [tableRows, setTableRows] = useState<ProcessFolderEntry[]>(
    projectSettings.processTable
  )
  const [archiveRows, setArchiveRows] = useState<string[]>(
    projectSettings.archivePatterns ?? DEFAULT_PROJECT_SETTINGS.archivePatterns
  )

  const errors = selectProcessTableErrors(useAppStore.getState())

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

  const addRow = () => {
    const next = [...tableRows, { suffix: '', folderNames: [] }]
    setTableRows(next)
    updateProcessTable(next)
  }

  const removeRow = (i: number) => {
    const next = tableRows.filter((_, idx) => idx !== i)
    setTableRows(next)
    updateProcessTable(next)
  }

  const handleExport = () => {
    const json = exportSettings()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'csp-paperback-settings.json'
    a.click()
    URL.revokeObjectURL(url)
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

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      importSettings(text)
      const s = useAppStore.getState().projectSettings
      setTableRows(s.processTable)
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
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <span className={styles.title}>{t.settings.title}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {/* 工程テーブル */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t.settings.processTable}</div>
            <div className={styles.tableHeader}>
              <span>{t.settings.colSuffix}</span>
              <span>{t.settings.colFolderNames}</span>
              <span>出力サンプル</span>
              <span></span>
            </div>
            {tableRows.map((row, i) => (
              <div key={i} className={styles.tableRow}>
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
                <span className={styles.sampleLabel}>
                  {`A_0001${row.suffix || ''}.jpg`}
                </span>
                <button className={styles.removeRowBtn} onClick={() => removeRow(i)}>✕</button>
              </div>
            ))}
            {errors.size > 0 && (
              <div className={styles.errorMsg}>
                {t.settings.duplicateError}{[...errors].join(', ')}
              </div>
            )}
            <button className={styles.addRowBtn} onClick={addRow}>{t.settings.addRow}</button>
          </div>

          {/* アーカイブ除外パターン */}
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
            <div className={styles.ioRow}>
              <button className={styles.ioBtn} onClick={handleExport}>{t.settings.exportJson}</button>
              <button className={styles.ioBtn} onClick={handleImport}>{t.settings.importJson}</button>
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
