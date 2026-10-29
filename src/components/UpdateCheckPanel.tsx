import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '../i18n/locale'
import { Modal } from './Modal'
import { isDesktopRuntime } from '../platform/runtime'
import type { DesktopUpdateInfo } from '../platform/update-check'
import { checkAndRememberDesktopUpdate, useDesktopUpdateStore } from '../store/desktop-update'
import { openDesktopReleasesPage } from '../platform/external-links'
import styles from './UpdateCheckPanel.module.css'

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'success'; info: DesktopUpdateInfo }
  | { status: 'error'; message: string }

function useUpdateCheck(initialInfo?: DesktopUpdateInfo) {
  const [state, setState] = useState<CheckState>(initialInfo ? { status: 'success', info: initialInfo } : { status: 'idle' })

  useEffect(() => {
    // A response arriving after the dialog was closed has not been seen.
    if (state.status === 'success' && state.info.hasUpdate) {
      useDesktopUpdateStore.getState().markNotified(state.info.latestVersion)
    }
  }, [state])

  const handleCheck = useCallback(async () => {
    setState({ status: 'checking' })
    try {
      const info = await checkAndRememberDesktopUpdate()
      setState({ status: 'success', info })
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
            自動確認の設定にかかわらず、今すぐ GitHub Releases の最新情報を確認できます。
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
  initialInfo?: DesktopUpdateInfo
}

export function UpdateCheckDialog({ onClose, initialInfo }: UpdateCheckDialogProps) {
  const { t } = useLocale()
  const { state, handleCheck, handleOpenRelease } = useUpdateCheck(initialInfo)
  const startedRef = useRef(false)

  useEffect(() => {
    if (initialInfo || startedRef.current) return
    startedRef.current = true
    void handleCheck()
  }, [handleCheck, initialInfo])

  return (
    <Modal className={styles.overlay} labelledBy="update-check-title" onClose={onClose}>
      <div className={styles.dialog}>
        <div className={styles.dialogHeader}>
          <span id="update-check-title" className={styles.dialogTitle}>{initialInfo ? '新しいバージョンがあります' : t.toolbar.updateCheck}</span>
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="更新確認を閉じる">✕</button>
        </div>
        <div className={styles.dialogBody}>
          {state.status === 'checking' && (
            <div className={styles.checking}>GitHub Releases の最新情報を確認しています…</div>
          )}
          <UpdateCheckResult state={state} onOpenRelease={() => void handleOpenRelease()} />
          {initialInfo && <p className={styles.note}>ダウンロード・インストールは自動で行いません。この版の自動通知は今回だけです。あとから通常画面のメニューの「更新確認」で開けます。</p>}
          {state.status === 'error' && (
            <button className={styles.button} type="button" onClick={() => void handleCheck()}>
              {t.toolbar.updateCheck}
            </button>
          )}
          <button className={styles.button} type="button" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </Modal>
  )
}
