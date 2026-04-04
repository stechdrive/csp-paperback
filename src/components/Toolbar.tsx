import { useRef, useState } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n'
import { ExportDialog } from './ExportDialog'
import { SettingsDialog } from './SettingsDialog'
import styles from './Toolbar.module.css'

interface ToolbarProps {
  onPsdFile: (file: File) => void
  onXdtsFile: (file: File) => void
  isLoading: boolean
  error: string | null
  onSavePsd: () => void
  hasPsd: boolean
}

export function Toolbar({ onPsdFile, onXdtsFile, isLoading, error, onSavePsd, hasPsd }: ToolbarProps) {
  const psdFileName = useAppStore(s => s.psdFileName)
  const xdtsFileName = useAppStore(s => s.xdtsFileName)
  const psdInputRef = useRef<HTMLInputElement>(null)
  const xdtsInputRef = useRef<HTMLInputElement>(null)
  const [showExport, setShowExport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const { t, locale, setLocale } = useLocale()

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
          {t.toolbar.openPsd}
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
          {t.toolbar.openXdts}
        </button>
        <input
          ref={xdtsInputRef}
          type="file"
          accept=".xdts"
          style={{ display: 'none' }}
          onChange={handleXdtsChange}
        />

        <div className={styles.spacer} />

        {isLoading && <span className={styles.loading}>{t.toolbar.loading}</span>}
        {error && <span className={styles.error}>{error}</span>}
        {psdFileName && !isLoading && !error && (
          <span className={styles.fileInfo}>{psdFileName}</span>
        )}
        {xdtsFileName && !isLoading && !error && (
          <span className={styles.fileInfo}>{xdtsFileName}</span>
        )}

        <button
          className={styles.btn}
          onClick={onSavePsd}
          disabled={!hasPsd}
        >
          {t.toolbar.savePsd}
        </button>
        <button
          className={styles.btn}
          onClick={() => setShowSettings(true)}
        >
          {t.toolbar.settings}
        </button>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => setShowExport(true)}
          disabled={!psdFileName}
        >
          {t.toolbar.export}
        </button>
        <button
          className={styles.langBtn}
          onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}
          title="Toggle language"
        >
          {locale === 'ja' ? 'EN' : 'JA'}
        </button>
      </div>

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </>
  )
}
