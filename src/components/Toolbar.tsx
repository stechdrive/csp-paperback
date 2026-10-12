import { useRef, useState, useEffect } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { useExport } from '../hooks/useExport'
import { useIsMobile } from '../hooks/useIsMobile'
import type { OutputDestination } from '../types/output'
import type { LoadableFile } from '../platform/files'
import { pickProjectFiles, supportsNativeOpenDialog } from '../platform/files'
import { isDesktopRuntime } from '../platform/runtime'
import { supportsDirectoryExport } from '../utils/directory-builder'
import {
  MAX_MOBILE_UI_SCALE,
  MIN_MOBILE_UI_SCALE,
  percentToScale,
  scaleToPercent,
} from '../utils/mobile-ui-scale'
import { SettingsDialog } from './SettingsDialog'
import { HelpDialog } from './HelpDialog'
import { UpdateCheckDialog } from './UpdateCheckPanel'
import { Tooltip } from './Tooltip'
import styles from './Toolbar.module.css'

type IconName = 'menu' | 'open' | 'undo' | 'redo' | 'output' | 'navigator' | 'virtual' | 'help' | 'settings' | 'export' | 'info'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    menu: 'M4 6h16M4 12h16M4 18h16',
    open: 'M3 8V5h6l2 3h10l-3 12H3V8Zm0 3h17',
    undo: 'M9 5 4 10l5 5M4 10h9a6 6 0 0 1 6 6v3',
    redo: 'm15 5 5 5-5 5m5-5h-9a6 6 0 0 0-6 6v3',
    output: 'M4 4h16v16H4ZM4 16l5-5 4 4 3-3 4 4M15 8h.01',
    navigator: 'M3 3h6M3 3v6m18-6h-6m6 0v6M3 21h6m-6 0v-6m18 6h-6m6 0v-6M8 8h8v8H8Z',
    virtual: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
    help: 'M9.1 9a3 3 0 1 1 5.8 1c-.7 1.2-2.9 1.5-2.9 3.5M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
    settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
    export: 'M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6',
    info: 'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  }
  return <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

function MobileUiScaleControl() {
  const { t } = useLocale()
  const mobileUiScale = useAppStore(s => s.mobileUiScale)
  const setMobileUiScale = useAppStore(s => s.setMobileUiScale)
  const resetMobileUiScale = useAppStore(s => s.resetMobileUiScale)
  const value = scaleToPercent(mobileUiScale)
  const minimum = Math.round(MIN_MOBILE_UI_SCALE * 100)
  const maximum = Math.round(MAX_MOBILE_UI_SCALE * 100)

  return (
    <div className={styles.scaleControl}>
      <div className={styles.scaleHeader}>
        <label htmlFor="toolbar-ui-scale">{t.toolbar.uiScale}</label>
        <span className={styles.scaleValue}>{value}%</span>
      </div>
      <div className={styles.scaleControls}>
        <button className={styles.scaleAdjustBtn} onClick={() => setMobileUiScale(percentToScale(value - 1))} disabled={value <= minimum} aria-label={`${t.toolbar.uiScale} を 1% 小さく`}>−</button>
        <input id="toolbar-ui-scale" className={styles.scaleSlider} type="range" min={minimum} max={maximum} step={1} value={value} onChange={e => setMobileUiScale(percentToScale(Number(e.target.value)))} />
        <button className={styles.scaleAdjustBtn} onClick={() => setMobileUiScale(percentToScale(value + 1))} disabled={value >= maximum} aria-label={`${t.toolbar.uiScale} を 1% 大きく`}>+</button>
      </div>
      <div className={styles.scaleFooter}>
        <span>{minimum}%</span>
        <button className={styles.scaleReset} onClick={resetMobileUiScale} aria-label="表示サイズを100%に戻す">100%</button>
        <span>{maximum}%</span>
      </div>
    </div>
  )
}

interface ToolbarProps {
  onFiles: (files: LoadableFile[]) => Promise<void>
  isLoading: boolean
  error: string | null
  notification: string | null
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  previewMode: 'output' | 'navigator'
  onPreviewModeChange: (mode: 'output' | 'navigator') => void
  virtualPanelOpen: boolean
  onToggleVirtualPanel: () => void
}

export function Toolbar({ onFiles, isLoading, error, notification, canUndo, canRedo, onUndo, onRedo, previewMode, onPreviewModeChange, virtualPanelOpen, onToggleVirtualPanel }: ToolbarProps) {
  const psdFileName = useAppStore(s => s.psdFileName)
  const clipFileName = useAppStore(s => s.clipFileName)
  const xdtsFileName = useAppStore(s => s.xdtsFileName)
  const openInputRef = useRef<HTMLInputElement>(null)
  const appMenuRef = useRef<HTMLDivElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showUpdateCheck, setShowUpdateCheck] = useState(false)
  const [openPopover, setOpenPopover] = useState<'app' | 'export' | 'status' | null>(null)
  const { t } = useLocale()
  const { isExporting, progress, error: exportError, startExport } = useExport()
  const isMobile = useIsMobile()
  const canExportToDirectory = supportsDirectoryExport()
  const desktopRuntime = isDesktopRuntime()

  useEffect(() => {
    if (!openPopover) return
    const ref = openPopover === 'app' ? appMenuRef : openPopover === 'export' ? exportMenuRef : statusRef
    const handleOutside = (event: Event) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpenPopover(null)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpenPopover(null)
      ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    }
    document.addEventListener('pointerdown', handleOutside)
    document.addEventListener('focusin', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handleOutside)
      document.removeEventListener('focusin', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [openPopover])

  const handleOpenFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    await onFiles(files)
  }
  const handleOpenButtonClick = async () => {
    setOpenPopover(null)
    if (supportsNativeOpenDialog()) {
      const files = await pickProjectFiles()
      if (files.length > 0) await onFiles(files)
    } else {
      openInputRef.current?.click()
    }
  }
  const menuAction = (action: () => void) => {
    setOpenPopover(null)
    action()
  }
  const handleExportSelect = async (destination: OutputDestination) => {
    setOpenPopover(null)
    await startExport(destination)
  }
  const files = [clipFileName, psdFileName, xdtsFileName].filter(Boolean)
  const statusMessage = error || exportError || (isLoading ? t.toolbar.loading : isExporting ? `${t.export.exporting} ${Math.round(progress * 100)}%` : notification || files.join(' / '))
  const statusClass = error || exportError ? styles.error : isLoading || isExporting ? styles.loading : notification ? styles.notification : styles.fileInfo
  const hasStatus = Boolean(statusMessage)

  return (
    <>
      <div className={styles.toolbar} aria-label="プレビューと出力の操作">
        <div className={styles.menuWrap} ref={appMenuRef}>
          <button className={`${styles.btn} ${styles.iconBtn}`} onClick={() => setOpenPopover(openPopover === 'app' ? null : 'app')} aria-label="メニュー" title="CSP Paperback メニュー" aria-expanded={openPopover === 'app'} aria-controls="toolbar-app-menu"><Icon name="menu" /></button>
          {openPopover === 'app' && (
            <div className={`${styles.popover} ${styles.appMenu}`} id="toolbar-app-menu">
              <div className={styles.appIdentity}><strong>CSP Paperback</strong><span>v{__APP_VERSION__}</span></div>
              <button className={styles.menuItem} onClick={() => void handleOpenButtonClick()} disabled={isLoading}><Icon name="open" />ファイルを開く</button>
              <button className={styles.menuItem} onClick={() => menuAction(onUndo)} disabled={!canUndo}><Icon name="undo" />元に戻す <kbd>Ctrl+Z</kbd></button>
              <button className={styles.menuItem} onClick={() => menuAction(onRedo)} disabled={!canRedo}><Icon name="redo" />やり直し <kbd>Ctrl+Shift+Z</kbd></button>
              <div className={styles.menuSeparator} />
              <button className={styles.menuItem} onClick={() => menuAction(() => setShowHelp(true))}>? ヘルプ</button>
              <button className={styles.menuItem} onClick={() => menuAction(() => setShowSettings(true))}><Icon name="settings" />{t.toolbar.settings}</button>
              {desktopRuntime && <button className={styles.menuItem} onClick={() => menuAction(() => setShowUpdateCheck(true))}>{t.toolbar.updateCheck}</button>}
              {isMobile && <MobileUiScaleControl />}
              {files.length > 0 && <div className={styles.menuFiles}>{files.map((file, index) => <div key={index}>{file}</div>)}</div>}
            </div>
          )}
        </div>

        <Tooltip content={`${t.input.openTitle}\n${t.input.openHint}`} placement="bottom">
          <button className={`${styles.btn} ${styles.iconBtn} ${styles.openButton}`} onClick={() => void handleOpenButtonClick()} disabled={isLoading} aria-label="ファイルを開く" title="ファイルを開く"><Icon name="open" /></button>
        </Tooltip>
        <input ref={openInputRef} type="file" accept=".clip,.psd,.xdts,.json,*/*" multiple hidden onChange={handleOpenFiles} />

        <div className={styles.historyButtons}>
          <button className={`${styles.btn} ${styles.iconBtn}`} onClick={onUndo} disabled={!canUndo} aria-label="元に戻す" title="元に戻す (Ctrl+Z)"><Icon name="undo" /></button>
          <button className={`${styles.btn} ${styles.iconBtn}`} onClick={onRedo} disabled={!canRedo} aria-label="やり直し" title="やり直し (Ctrl+Shift+Z)"><Icon name="redo" /></button>
        </div>

        <div className={styles.viewSwitch} role="group" aria-label="メインプレビューの表示">
          <button className={`${styles.btn} ${styles.viewButton} ${previewMode === 'output' ? styles.active : ''}`} aria-label="出力プレビュー" title="出力プレビュー" aria-pressed={previewMode === 'output'} onClick={() => onPreviewModeChange('output')}><Icon name="output" /><span className={styles.fullLabel}>出力プレビュー</span><span className={styles.shortLabel}>出力</span></button>
          <button className={`${styles.btn} ${styles.viewButton} ${previewMode === 'navigator' ? styles.active : ''}`} aria-label="全体ナビゲーター" title="全体ナビゲーター" aria-pressed={previewMode === 'navigator'} onClick={() => onPreviewModeChange('navigator')}><Icon name="navigator" /><span className={styles.fullLabel}>全体ナビゲーター</span><span className={styles.shortLabel}>全体</span></button>
        </div>

        <button className={`${styles.btn} ${styles.virtualButton} ${virtualPanelOpen ? styles.active : ''}`} onClick={onToggleVirtualPanel} aria-label="仮想セル" title="仮想セルの編集パネルを開閉" aria-expanded={virtualPanelOpen} aria-pressed={virtualPanelOpen}><Icon name="virtual" /><span className={styles.fullLabel}>仮想セル</span></button>

        <div className={styles.statusArea} ref={statusRef}>
          {hasStatus && <button className={`${styles.statusButton} ${statusClass}`} onClick={() => setOpenPopover(openPopover === 'status' ? null : 'status')} aria-label={error || exportError ? 'エラーの詳細' : 'ファイルと処理状況'} title={statusMessage ?? undefined} aria-expanded={openPopover === 'status'} aria-controls="toolbar-status"><Icon name="info" /><span className={styles.statusText}>{statusMessage}</span></button>}
          {openPopover === 'status' && <div className={`${styles.popover} ${styles.statusPopover}`} id="toolbar-status">
            {isLoading && <p className={styles.loading}>{t.toolbar.loading}</p>}
            {isExporting && <p className={styles.loading}>{t.export.exporting} {Math.round(progress * 100)}%</p>}
            {error && <p className={styles.error}>{error}</p>}
            {exportError && <p className={styles.error}>{exportError}</p>}
            {notification && <p className={styles.notification}>{notification}</p>}
            {files.map((file, index) => <p key={index}>{file}</p>)}
          </div>}
          <span className={styles.srOnly} role="status">{isLoading || isExporting || error || exportError || notification ? statusMessage : ''}</span>
        </div>

        <div className={styles.utilityButtons}>
          <button className={`${styles.btn} ${styles.iconBtn}`} onClick={() => menuAction(() => setShowHelp(true))} aria-label="ヘルプ" title="使い方ヘルプを表示"><Icon name="help" /></button>
          <Tooltip content="書き出し詳細設定・工程フォルダリストの編集" placement="bottom"><button className={`${styles.btn} ${styles.iconBtn}`} onClick={() => menuAction(() => setShowSettings(true))} aria-label={t.toolbar.settings} title={t.toolbar.settings}><Icon name="settings" /></button></Tooltip>
        </div>

        <Tooltip content={canExportToDirectory ? desktopRuntime ? t.export.triggerHintChoiceDesktop : t.export.triggerHintChoiceBrowser : t.export.triggerHintZip} placement="bottom" disabled={openPopover === 'export'}>
          <div className={styles.menuWrap} ref={exportMenuRef}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => canExportToDirectory ? setOpenPopover(openPopover === 'export' ? null : 'export') : void handleExportSelect('zip')} disabled={(!psdFileName && !clipFileName) || isExporting || isLoading} aria-label={isExporting ? t.export.exporting : t.toolbar.export} aria-haspopup={canExportToDirectory ? 'menu' : undefined} aria-expanded={canExportToDirectory ? openPopover === 'export' : undefined} title={t.toolbar.export}>
              <Icon name="export" /><span>{t.toolbar.export}</span>{canExportToDirectory && <span className={styles.exportCaret}>▾</span>}
            </button>
            {canExportToDirectory && openPopover === 'export' && <div className={`${styles.popover} ${styles.exportMenu}`} role="menu">
              <button className={styles.menuItem} onClick={() => void handleExportSelect('zip')} disabled={isExporting} role="menuitem">{t.export.destinationZip}</button>
              <button className={styles.menuItem} onClick={() => void handleExportSelect('directory')} disabled={isExporting} role="menuitem">{t.export.destinationDirectory}</button>
            </div>}
          </div>
        </Tooltip>
      </div>

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
      {showUpdateCheck && <UpdateCheckDialog onClose={() => setShowUpdateCheck(false)} />}
    </>
  )
}
