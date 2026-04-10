import { useRef, useState, useEffect } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n'
import { useExport } from '../hooks/useExport'
import { SettingsDialog } from './SettingsDialog'
import { HelpDialog } from './HelpDialog'
import { Tooltip } from './Tooltip'
import styles from './Toolbar.module.css'

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse) and (max-width: 1024px)')
    setMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return mobile
}

function OverflowMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  return (
    <div className={styles.overflowWrap} ref={menuRef}>
      <button className={styles.btn} onClick={() => setOpen(v => !v)} aria-label="メニュー">⋯</button>
      {open && (
        <div className={styles.overflowMenu} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

interface ToolbarProps {
  onFiles: (files: File[]) => Promise<void>
  isLoading: boolean
  error: string | null
  notification: string | null
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

export function Toolbar({ onFiles, isLoading, error, notification, canUndo, canRedo, onUndo, onRedo }: ToolbarProps) {
  const psdFileName = useAppStore(s => s.psdFileName)
  const xdtsFileName = useAppStore(s => s.xdtsFileName)
  const openInputRef = useRef<HTMLInputElement>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const { t } = useLocale()
  const { isExporting, progress, error: exportError, startExport } = useExport()
  const isMobile = useIsMobile()

  const handleOpenFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    await onFiles(files)
  }

  const openFileBtn = (
    <Tooltip
      content={"PSD / XDTS / 工程設定JSON を開く\n複数ファイルを同時に選択できます"}
      placement="bottom"
    >
      <button
        className={styles.btn}
        onClick={() => openInputRef.current?.click()}
        disabled={isLoading}
      >
        ファイルを開く
      </button>
    </Tooltip>
  )

  const fileInput = (
    <input
      ref={openInputRef}
      type="file"
      accept=".psd,.xdts,.json,*/*"
      multiple
      style={{ display: 'none' }}
      onChange={handleOpenFiles}
    />
  )

  const undoBtn = (
    <Tooltip content="元に戻す (Ctrl+Z)" placement="bottom">
      <button className={styles.btn} onClick={onUndo} disabled={!canUndo}>↩</button>
    </Tooltip>
  )
  const redoBtn = (
    <Tooltip content="やり直し (Ctrl+Shift+Z)" placement="bottom">
      <button className={styles.btn} onClick={onRedo} disabled={!canRedo}>↪</button>
    </Tooltip>
  )

  const statusArea = (
    <>
      {isLoading && <span className={styles.loading}>{t.toolbar.loading}</span>}
      {error && <span className={styles.error}>{error}</span>}
      {exportError && <span className={styles.error}>{exportError}</span>}
      {notification && !error && !exportError && (
        <span className={styles.notification}>{notification}</span>
      )}
      {isExporting && (
        <span className={styles.loading}>{t.export.exporting} {Math.round(progress * 100)}%</span>
      )}
      {psdFileName && !isLoading && !error && (
        <span className={styles.fileInfo}>{psdFileName}</span>
      )}
      {xdtsFileName && !isLoading && !error && (
        <span className={styles.fileInfo}>{xdtsFileName}</span>
      )}
    </>
  )

  const helpBtn = (
    <button
      className={isMobile ? styles.menuItem : styles.btn}
      onClick={() => setShowHelp(true)}
    >
      ?　ヘルプ
    </button>
  )
  const settingsBtn = (
    <button
      className={isMobile ? styles.menuItem : styles.btn}
      onClick={() => setShowSettings(true)}
    >
      {isMobile ? '⚙　' : ''}{t.toolbar.settings}
    </button>
  )
  const exportBtn = (
    <Tooltip content="書き出し設定にしたがってセル画像を ZIP で出力" placement="bottom">
      <button
        className={`${styles.btn} ${styles.btnPrimary}`}
        onClick={startExport}
        disabled={!psdFileName || isExporting}
      >
        {isExporting ? t.export.exporting : t.toolbar.export}
      </button>
    </Tooltip>
  )

  return (
    <>
      <div className={styles.toolbar}>
        <span className={styles.title}>CSP Paperback</span>
        <span className={styles.version}>v{__APP_VERSION__}</span>

        {openFileBtn}
        {fileInput}

        {!isMobile && undoBtn}
        {!isMobile && redoBtn}

        <div className={styles.spacer} />

        {statusArea}

        {!isMobile && (
          <Tooltip content="使い方ヘルプを表示" placement="bottom">
            <button className={styles.btn} onClick={() => setShowHelp(true)}>?</button>
          </Tooltip>
        )}
        {!isMobile && (
          <Tooltip content="書き出し詳細設定・工程テーブルの編集" placement="bottom">
            <button className={styles.btn} onClick={() => setShowSettings(true)}>{t.toolbar.settings}</button>
          </Tooltip>
        )}

        {exportBtn}

        {isMobile && (
          <OverflowMenu>
            <button className={styles.menuItem} onClick={onUndo} disabled={!canUndo}>↩　元に戻す</button>
            <button className={styles.menuItem} onClick={onRedo} disabled={!canRedo}>↪　やり直し</button>
            {settingsBtn}
            {helpBtn}
          </OverflowMenu>
        )}
      </div>

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
    </>
  )
}
