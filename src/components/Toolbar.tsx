import { useRef, useState, useEffect } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { useExport } from '../hooks/useExport'
import { useIsMobile } from '../hooks/useIsMobile'
import {
  MAX_MOBILE_UI_SCALE,
  MIN_MOBILE_UI_SCALE,
  percentToScale,
  scaleToPercent,
} from '../utils/mobile-ui-scale'
import { SettingsDialog } from './SettingsDialog'
import { HelpDialog } from './HelpDialog'
import { Tooltip } from './Tooltip'
import styles from './Toolbar.module.css'

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

function MobileUiScaleControl() {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const { t } = useLocale()
  const mobileUiScale = useAppStore(s => s.mobileUiScale)
  const setMobileUiScale = useAppStore(s => s.setMobileUiScale)
  const resetMobileUiScale = useAppStore(s => s.resetMobileUiScale)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
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

  const value = scaleToPercent(mobileUiScale)

  return (
    <div className={styles.scaleWrap} ref={popoverRef}>
      <button
        className={`${styles.btn} ${open ? styles.scaleBtnActive : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-label={t.toolbar.uiScale}
        aria-expanded={open}
      >
        Aa
      </button>
      {open && (
        <div className={styles.scalePopover}>
          <div className={styles.scaleHeader}>
            <span>{t.toolbar.uiScale}</span>
            <span className={styles.scaleValue}>{value}%</span>
          </div>
          <input
            className={styles.scaleSlider}
            type="range"
            min={Math.round(MIN_MOBILE_UI_SCALE * 100)}
            max={Math.round(MAX_MOBILE_UI_SCALE * 100)}
            step={5}
            value={value}
            onChange={(e) => setMobileUiScale(percentToScale(Number(e.target.value)))}
          />
          <div className={styles.scaleFooter}>
            <span className={styles.scaleRange}>{Math.round(MIN_MOBILE_UI_SCALE * 100)}%</span>
            <button className={styles.scaleReset} onClick={resetMobileUiScale}>100%</button>
            <span className={styles.scaleRange}>{Math.round(MAX_MOBILE_UI_SCALE * 100)}%</span>
          </div>
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
      ? ヘルプ
    </button>
  )
  const settingsBtn = (
    <button
      className={isMobile ? styles.menuItem : styles.btn}
      onClick={() => setShowSettings(true)}
    >
      {isMobile ? '⚙ ' : ''}{t.toolbar.settings}
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
          <Tooltip content={"書き出し詳細設定・工程フォルダリストの編集\n各スタジオのテンプレートや命名ルールに合わせて調整できます"} placement="bottom">
            <button className={styles.btn} onClick={() => setShowSettings(true)}>{t.toolbar.settings}</button>
          </Tooltip>
        )}

        {isMobile && <MobileUiScaleControl />}
        {exportBtn}

        {isMobile && (
          <OverflowMenu>
            <button className={styles.menuItem} onClick={onUndo} disabled={!canUndo}>↩ 元に戻す</button>
            <button className={styles.menuItem} onClick={onRedo} disabled={!canRedo}>↪ やり直し</button>
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
