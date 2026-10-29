import { useEffect, useState } from 'react'
import { isDesktopRuntime } from '../platform/runtime'
import type { DesktopUpdateInfo } from '../platform/update-check'
import { checkAndRememberDesktopUpdate, UPDATE_CHECK_WEEK_MS, useDesktopUpdateStore } from '../store/desktop-update'

const RETRY_DELAY_MS = 60 * 60 * 1000

/** Check scheduling and notification readiness are independent of the dialog UI. */
export function useAutomaticUpdateCheck(busy: boolean) {
  const frequency = useDesktopUpdateStore(s => s.frequency)
  const lastNotifiedVersion = useDesktopUpdateStore(s => s.lastNotifiedVersion)
  const [pending, setPending] = useState<DesktopUpdateInfo | null>(null)
  const [notification, setNotification] = useState<DesktopUpdateInfo | null>(null)

  useEffect(() => {
    if (!isDesktopRuntime()) return
    let disposed = false
    let checking = false
    let lastAttemptAt: number | null = null

    const check = async () => {
      const settings = useDesktopUpdateStore.getState()
      if (disposed || checking || settings.frequency === 'off' || document.hidden || !navigator.onLine) return
      const now = Date.now()
      if (settings.frequency === 'startup' && lastAttemptAt !== null) return
      if (settings.frequency === 'weekly' && settings.lastCheckedAt !== null
        && now >= settings.lastCheckedAt && now - settings.lastCheckedAt < UPDATE_CHECK_WEEK_MS) return
      // Failed checks do not postpone the next successful weekly check by a week.
      if (lastAttemptAt !== null && now >= lastAttemptAt && now - lastAttemptAt < RETRY_DELAY_MS) return

      checking = true
      lastAttemptAt = now
      try {
        const info = await checkAndRememberDesktopUpdate()
        const current = useDesktopUpdateStore.getState()
        if (!disposed && current.frequency !== 'off' && info.hasUpdate
          && info.latestVersion !== current.lastNotifiedVersion) setPending(info)
      } catch {
        // Offline, timeout and rate limiting must not interrupt artwork tasks.
      } finally {
        checking = false
      }
    }

    // Also avoids duplicate requests during React StrictMode's effect replay.
    const startup = window.setTimeout(() => void check(), 1000)
    const interval = window.setInterval(() => void check(), 60_000)
    const onWake = () => { void check() }
    window.addEventListener('focus', onWake)
    window.addEventListener('online', onWake)
    document.addEventListener('visibilitychange', onWake)
    const unsubscribe = useDesktopUpdateStore.subscribe((state, previous) => {
      if (state.frequency !== previous.frequency) void check()
    })
    return () => {
      disposed = true
      window.clearTimeout(startup)
      window.clearInterval(interval)
      window.removeEventListener('focus', onWake)
      window.removeEventListener('online', onWake)
      document.removeEventListener('visibilitychange', onWake)
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!pending || busy || frequency === 'off' || pending.latestVersion === lastNotifiedVersion) return
    const showWhenReady = () => {
      if (document.hidden || document.querySelector('dialog[open]')) return
      setNotification(pending)
      setPending(null)
    }
    const next = window.setTimeout(showWhenReady, 0)
    const interval = window.setInterval(showWhenReady, 1000)
    return () => {
      window.clearTimeout(next)
      window.clearInterval(interval)
    }
  }, [pending, busy, frequency, lastNotifiedVersion])

  return {
    notification: frequency === 'off' ? null : notification,
    dismiss: () => setNotification(null),
  }
}
