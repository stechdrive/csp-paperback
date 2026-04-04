import { useRef, useState } from 'react'
import { useAppStore } from '../store'
import { ExportDialog } from './ExportDialog'
import { SettingsDialog } from './SettingsDialog'
import styles from './Toolbar.module.css'

interface ToolbarProps {
  onPsdFile: (file: File) => void
  onXdtsFile: (file: File) => void
  isLoading: boolean
  error: string | null
}

export function Toolbar({ onPsdFile, onXdtsFile, isLoading, error }: ToolbarProps) {
  const psdFileName = useAppStore(s => s.psdFileName)
  const xdtsFileName = useAppStore(s => s.xdtsFileName)
  const psdInputRef = useRef<HTMLInputElement>(null)
  const xdtsInputRef = useRef<HTMLInputElement>(null)
  const [showExport, setShowExport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const handlePsdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onPsdFile(file)
    e.target.value = ''
  }

  const handleXdtsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onXdtsFile(file)
    e.target.value = ''
  }

  return (
    <>
      <div className={styles.toolbar}>
        <span className={styles.title}>csp-paperback</span>

        <button
          className={styles.btn}
          onClick={() => psdInputRef.current?.click()}
          disabled={isLoading}
        >
          PSD を開く
        </button>
        <input
          ref={psdInputRef}
          type="file"
          accept=".psd"
          style={{ display: 'none' }}
          onChange={handlePsdChange}
        />

        <button
          className={styles.btn}
          onClick={() => xdtsInputRef.current?.click()}
          disabled={isLoading}
        >
          xdts を開く
        </button>
        <input
          ref={xdtsInputRef}
          type="file"
          accept=".xdts"
          style={{ display: 'none' }}
          onChange={handleXdtsChange}
        />

        <div className={styles.spacer} />

        {isLoading && <span className={styles.loading}>読み込み中…</span>}
        {error && <span className={styles.error}>{error}</span>}
        {psdFileName && !isLoading && !error && (
          <span className={styles.fileInfo}>{psdFileName}</span>
        )}
        {xdtsFileName && !isLoading && !error && (
          <span className={styles.fileInfo}>{xdtsFileName}</span>
        )}

        <button
          className={styles.btn}
          onClick={() => setShowSettings(true)}
        >
          設定
        </button>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => setShowExport(true)}
          disabled={!psdFileName}
        >
          出力
        </button>
      </div>

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </>
  )
}
