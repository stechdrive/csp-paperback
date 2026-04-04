import { useState } from 'react'
import { useAppStore } from '../store'
import { selectProcessTableErrors } from '../store/selectors'
import type { ProcessFolderEntry } from '../types'
import styles from './SettingsDialog.module.css'

interface SettingsDialogProps {
  onClose: () => void
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const projectSettings = useAppStore(s => s.projectSettings)
  const updateProcessTable = useAppStore(s => s.updateProcessTable)
  const setSequenceDigits = useAppStore(s => s.setSequenceDigits)
  const setDefaultMode = useAppStore(s => s.setDefaultMode)
  const importSettings = useAppStore(s => s.importSettings)
  const exportSettings = useAppStore(s => s.exportSettings)

  const [tableRows, setTableRows] = useState<ProcessFolderEntry[]>(
    projectSettings.processTable
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

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      importSettings(text)
      setTableRows(useAppStore.getState().projectSettings.processTable)
    }
    input.click()
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <span className={styles.title}>プロジェクト設定</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {/* 工程テーブル */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>工程フォルダテーブル</div>
            <div className={styles.tableHeader}>
              <span>サフィックス</span>
              <span>フォルダ名（カンマ区切り）</span>
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
                <button className={styles.removeRowBtn} onClick={() => removeRow(i)}>✕</button>
              </div>
            ))}
            {errors.size > 0 && (
              <div className={styles.errorMsg}>
                重複するフォルダ名があります: {[...errors].join(', ')}
              </div>
            )}
            <button className={styles.addRowBtn} onClick={addRow}>＋ 行を追加</button>
          </div>

          {/* 連番桁数 */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>連番桁数</div>
            <div className={styles.row}>
              <span className={styles.label}>桁数</span>
              <input
                type="number" min={1} max={8}
                className={styles.input}
                value={projectSettings.sequenceDigits}
                onChange={e => setSequenceDigits(parseInt(e.target.value) || 4)}
              />
            </div>
          </div>

          {/* デフォルトモード */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>デフォルト動作モード</div>
            <div className={styles.row}>
              <span className={styles.label}>モード</span>
              <select
                className={styles.select}
                value={projectSettings.defaultMode}
                onChange={e => setDefaultMode(e.target.value as 'normal' | 'cell-inclusive')}
              >
                <option value="cell-inclusive">セル内包型（推奨）</option>
                <option value="normal">通常</option>
              </select>
            </div>
          </div>

          {/* JSON import/export */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>設定の共有</div>
            <div className={styles.ioRow}>
              <button className={styles.ioBtn} onClick={handleExport}>JSON エクスポート</button>
              <button className={styles.ioBtn} onClick={handleImport}>JSON インポート</button>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.doneBtn} onClick={onClose}>完了</button>
        </div>
      </div>
    </div>
  )
}
