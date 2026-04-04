import { useRef, useState } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n'
import { useExport } from '../hooks/useExport'
import { SettingsDialog } from './SettingsDialog'
import styles from './Toolbar.module.css'

function XdtsDownloadButton({ hasPsd }: { hasPsd: boolean }) {
  const downloadXdts = useAppStore(s => s.downloadXdts)
  const singleMarks = useAppStore(s => s.singleMarks)
  const virtualSets = useAppStore(s => s.virtualSets)
  const manualAnimFolderIds = useAppStore(s => s.manualAnimFolderIds)

  const hasExtras =
    [...singleMarks.values()].some(m => m.origin === 'manual') ||
    virtualSets.length > 0 ||
    manualAnimFolderIds.size > 0

  if (!hasPsd || !hasExtras) return null

  return (
    <button className={styles.btn} onClick={downloadXdts}>
      xdts保存
    </button>
  )
}

interface ToolbarProps {
  onPsdFile: (file: File) => Promise<void>
  onXdtsFile: (file: File) => Promise<void>
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
  const [showSettings, setShowSettings] = useState(false)
  const { t, locale, setLocale } = useLocale()
  const { isExporting, progress, error: exportError, startExport } = useExport()

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
        <span className={styles.title}>CSP Paperback</span>
        <span className={styles.version}>v{__APP_VERSION__}</span>

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
        {exportError && <span className={styles.error}>{exportError}</span>}
        {isExporting && (
          <span className={styles.loading}>{t.export.exporting} {Math.round(progress * 100)}%</span>
        )}
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
        <XdtsDownloadButton hasPsd={hasPsd} />
        <button
          className={styles.btn}
          onClick={() => setShowSettings(true)}
        >
          {t.toolbar.settings}
        </button>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={startExport}
          disabled={!psdFileName || isExporting}
        >
          {isExporting ? t.export.exporting : t.toolbar.export}
        </button>
        <button
          className={styles.langBtn}
          onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}
          title="Toggle language"
        >
          {locale === 'ja' ? 'EN' : 'JA'}
        </button>
      </div>

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </>
  )
}
