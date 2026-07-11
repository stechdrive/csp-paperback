import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '../i18n/locale'
import { isDesktopRuntime } from '../platform/runtime'
import { checkDesktopUpdate, type DesktopUpdateInfo } from '../platform/update-check'
import { openDesktopReleasesPage } from '../platform/external-links'
import styles from './UpdateCheckPanel.module.css'

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'success'; info: DesktopUpdateInfo }
  | { status: 'error'; message: string }

function useUpdateCheck() {
  const [state, setState] = useState<CheckState>({ status: 'idle' })

  const handleCheck = useCallback(async () => {
    setState({ status: 'checking' })
    try {
      setState({ status: 'success', info: await checkDesktopUpdate() })
    } catch {
      setState({
        status: 'error',
        message: '更新情報を取得できませんでした。時間をおいて再度確認してください。',
      })
    }
  }, [])

  const handleOpenRelease = useCallback(async () => {
    try {
      await openDesktopReleasesPage()
    } catch {
      setState({
        status: 'error',
        message: 'GitHub Releases を開けませんでした。ブラウザで手動アクセスしてください。',
      })
    }
  }, [])

  return { state, handleCheck, handleOpenRelease }
}

function UpdateCheckResult({
  state,
  onOpenRelease,
}: {
  state: CheckState
  onOpenRelease: () => void
}) {
  return (
    <>
      {state.status === 'success' && (
        <div className={state.info.hasUpdate ? styles.update : styles.latest}>
          {state.info.hasUpdate
            ? `新しい版 v${state.info.latestVersion} があります。現在の版は v${state.info.currentVersion} です。`
            : `最新版です。現在の版: v${state.info.currentVersion}`}
          {state.info.hasUpdate && (
            <button
              className={styles.linkButton}
              type="button"
              onClick={onOpenRelease}
            >
              GitHub Releases をブラウザで開く
            </button>
          )}
        </div>
      )}

      {state.status === 'error' && (
        <div className={styles.error}>{state.message}</div>
      )}
    </>
  )
}

export function UpdateCheckPanel() {
  const { t } = useLocale()
  const { state, handleCheck, handleOpenRelease } = useUpdateCheck()

  if (!isDesktopRuntime()) return null

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>デスクトップ版の更新確認</div>
          <div className={styles.note}>
            このボタンを押した時だけ GitHub Releases の最新情報を確認します。
          </div>
        </div>
        <button
          className={styles.button}
          type="button"
          onClick={() => void handleCheck()}
          disabled={state.status === 'checking'}
        >
          {state.status === 'checking' ? '確認中…' : t.toolbar.updateCheck}
        </button>
      </div>

      <UpdateCheckResult state={state} onOpenRelease={() => void handleOpenRelease()} />
    </div>
  )
}

interface UpdateCheckDialogProps {
  onClose: () => void
}

export function UpdateCheckDialog({ onClose }: UpdateCheckDialogProps) {
  const { t } = useLocale()
  const { state, handleCheck, handleOpenRelease } = useUpdateCheck()
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void handleCheck()
  }, [handleCheck])

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="update-check-title">
        <div className={styles.dialogHeader}>
          <span id="update-check-title" className={styles.dialogTitle}>{t.toolbar.updateCheck}</span>
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className={styles.dialogBody}>
          {state.status === 'checking' && (
            <div className={styles.checking}>GitHub Releases の最新情報を確認しています…</div>
          )}
          <UpdateCheckResult state={state} onOpenRelease={() => void handleOpenRelease()} />
          {state.status === 'error' && (
            <button className={styles.button} type="button" onClick={() => void handleCheck()}>
              {t.toolbar.updateCheck}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
