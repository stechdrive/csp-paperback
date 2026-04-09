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

// 現状 UI 非表示（#1 対応）。将来の再露出のため定義は残している。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      XDTS保存
    </button>
  )
}

interface ToolbarProps {
  onPsdFile: (file: File) => Promise<void>
  onXdtsFile: (file: File) => Promise<void>
  onCspbFile: (file: File) => Promise<void>
  onSaveCspb: () => void
  isLoading: boolean
  error: string | null
  notification: string | null
  onSavePsd: () => void
  hasPsd: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

export function Toolbar({ onPsdFile, onXdtsFile, onCspbFile, onSaveCspb, isLoading, error, notification, hasPsd, canUndo, canRedo, onUndo, onRedo }: ToolbarProps) {
  const psdFileName = useAppStore(s => s.psdFileName)
  const xdtsFileName = useAppStore(s => s.xdtsFileName)
  const importSettings = useAppStore(s => s.importSettings)
  const openInputRef = useRef<HTMLInputElement>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const { t } = useLocale()
  const { isExporting, progress, error: exportError, startExport } = useExport()
  const isMobile = useIsMobile()

  const handleOpenFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const ext = (f: File) => f.name.toLowerCase().split('.').pop() ?? ''
    // xdts → psd → cspb → json の順に処理
    for (const f of files.filter(f => ext(f) === 'xdts')) await onXdtsFile(f)
    for (const f of files.filter(f => ext(f) === 'psd')) await onPsdFile(f)
    for (const f of files.filter(f => ext(f) === 'cspb')) await onCspbFile(f)
    for (const f of files.filter(f => ext(f) === 'json')) importSettings(await f.text())
  }

  const openFileBtn = (
    <Tooltip
      content={"PSD / XDTS / .cspb / 工程設定JSON を開く\n複数ファイルを同時に選択できます"}
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
      accept=".psd,.xdts,.cspb,.json,*/*"
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

  const saveCspbBtn = (
    <button
      className={isMobile ? styles.menuItem : styles.btn}
      onClick={onSaveCspb}
      disabled={!hasPsd}
    >
      設定保存
    </button>
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

        {/* XDTS 書き出しボタンは現状ユーザが使う機会がないため UI 非表示化（#1 対応）。
            downloadXdts() 関数本体と XdtsDownloadButton コンポーネントは将来の再露出のため残している。 */}
        {!isMobile && (
          <Tooltip content="マーク・仮想セット・工程設定・XDTSを .cspb ファイルに保存" placement="bottom">
            {saveCspbBtn}
          </Tooltip>
        )}
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
            {saveCspbBtn}
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
