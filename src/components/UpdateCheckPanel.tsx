import { useState } from 'react'
import { isDesktopRuntime } from '../platform/runtime'
import { checkDesktopUpdate, type DesktopUpdateInfo } from '../platform/update-check'
import { openDesktopReleasesPage } from '../platform/external-links'
import styles from './UpdateCheckPanel.module.css'

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'success'; info: DesktopUpdateInfo }
  | { status: 'error'; message: string }

export function UpdateCheckPanel() {
  const [state, setState] = useState<CheckState>({ status: 'idle' })

  if (!isDesktopRuntime()) return null

  const handleCheck = async () => {
    setState({ status: 'checking' })
    try {
      setState({ status: 'success', info: await checkDesktopUpdate() })
    } catch {
      setState({
        status: 'error',
        message: '更新情報を取得できませんでした。時間をおいて再度確認してください。',
      })
    }
  }

  const handleOpenRelease = async () => {
    try {
      await openDesktopReleasesPage()
    } catch {
      setState({
        status: 'error',
        message: 'GitHub Releases を開けませんでした。ブラウザで手動アクセスしてください。',
      })
    }
  }

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
          {state.status === 'checking' ? '確認中…' : '更新を確認'}
        </button>
      </div>

      {state.status === 'success' && (
        <div className={state.info.hasUpdate ? styles.update : styles.latest}>
          {state.info.hasUpdate
            ? `新しい版 v${state.info.latestVersion} があります。現在の版は v${state.info.currentVersion} です。`
            : `最新版です。現在の版: v${state.info.currentVersion}`}
          {state.info.hasUpdate && (
            <button
              className={styles.linkButton}
              type="button"
              onClick={() => void handleOpenRelease()}
            >
              GitHub Releases をブラウザで開く
            </button>
          )}
        </div>
      )}

      {state.status === 'error' && (
        <div className={styles.error}>{state.message}</div>
      )}
    </div>
  )
}
