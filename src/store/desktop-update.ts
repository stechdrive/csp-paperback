import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { checkDesktopUpdate, type DesktopUpdateInfo } from '../platform/update-check'

export type UpdateCheckFrequency = 'off' | 'startup' | 'weekly'
export const UPDATE_CHECK_WEEK_MS = 7 * 24 * 60 * 60 * 1000

interface DesktopUpdateSettings {
  frequency: UpdateCheckFrequency
  lastCheckedAt: number | null
  lastNotifiedVersion: string | null
}

interface DesktopUpdateStore extends DesktopUpdateSettings {
  setFrequency: (frequency: UpdateCheckFrequency) => void
  markNotified: (version: string) => void
}

// Device preferences are separate from artwork settings, their JSON and Undo.
export const useDesktopUpdateStore = create<DesktopUpdateStore>()(persist(
  (set, get) => ({
    frequency: 'weekly',
    lastCheckedAt: null,
    lastNotifiedVersion: null,
    setFrequency: frequency => set({ frequency }),
    markNotified: lastNotifiedVersion => {
      if (get().lastNotifiedVersion !== lastNotifiedVersion) set({ lastNotifiedVersion })
    },
  }),
  {
    name: 'csp-paperback:desktop-updates',
    storage: createJSONStorage(() => localStorage),
    partialize: ({ frequency, lastCheckedAt, lastNotifiedVersion }): DesktopUpdateSettings =>
      ({ frequency, lastCheckedAt, lastNotifiedVersion }),
    merge: (persisted, current) => {
      const saved = persisted as Partial<Record<keyof DesktopUpdateSettings, unknown>> | null
      return {
        ...current,
        frequency: saved?.frequency === 'off' || saved?.frequency === 'startup' ? saved.frequency : 'weekly',
        lastCheckedAt: typeof saved?.lastCheckedAt === 'number' && Number.isFinite(saved.lastCheckedAt)
          && saved.lastCheckedAt >= 0 && saved.lastCheckedAt <= Date.now() ? saved.lastCheckedAt : null,
        lastNotifiedVersion: typeof saved?.lastNotifiedVersion === 'string'
          && /^\d+\.\d+\.\d+$/.test(saved.lastNotifiedVersion) ? saved.lastNotifiedVersion : null,
      }
    },
  },
))

let inFlight: Promise<DesktopUpdateInfo> | null = null

/** Manual and automatic checks share one request and the last successful check. */
export function checkAndRememberDesktopUpdate(): Promise<DesktopUpdateInfo> {
  if (!inFlight) {
    inFlight = checkDesktopUpdate()
      .then(info => {
        useDesktopUpdateStore.setState({ lastCheckedAt: Date.now() })
        return info
      })
      .finally(() => { inFlight = null })
  }
  return inFlight
}
