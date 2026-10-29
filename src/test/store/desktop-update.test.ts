import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkDesktopUpdate } from '../../platform/update-check'
import { checkAndRememberDesktopUpdate, useDesktopUpdateStore } from '../../store/desktop-update'

vi.mock('../../platform/update-check', () => ({ checkDesktopUpdate: vi.fn() }))
const check = vi.mocked(checkDesktopUpdate)
const key = 'csp-paperback:desktop-updates'
const info = { currentVersion: '1.40.313', latestVersion: '1.41.314', hasUpdate: true }

beforeEach(() => {
  useDesktopUpdateStore.setState({ frequency: 'weekly', lastCheckedAt: null, lastNotifiedVersion: null })
  localStorage.removeItem(key)
  vi.resetAllMocks()
})
afterEach(() => localStorage.removeItem(key))

describe('desktop update preferences', () => {
  it('restores off, the last successful check and the notified version across launches', async () => {
    const lastCheckedAt = Date.now() - 1000
    useDesktopUpdateStore.getState().setFrequency('off')
    useDesktopUpdateStore.setState({ lastCheckedAt, lastNotifiedVersion: info.latestVersion })
    const saved = localStorage.getItem(key)!
    useDesktopUpdateStore.setState({ frequency: 'startup', lastCheckedAt: null, lastNotifiedVersion: null })
    localStorage.setItem(key, saved)
    await useDesktopUpdateStore.persist.rehydrate()
    expect(useDesktopUpdateStore.getState()).toMatchObject({ frequency: 'off', lastCheckedAt, lastNotifiedVersion: info.latestVersion })
  })

  it.each([null, {}, { frequency: true, lastCheckedAt: 'yesterday', lastNotifiedVersion: 1 },
    { frequency: 'unknown', lastCheckedAt: -1, lastNotifiedVersion: '1.2.3-beta' },
    { lastCheckedAt: Number.MAX_SAFE_INTEGER }])('recovers missing or malformed preferences: %j', async state => {
    localStorage.setItem(key, JSON.stringify({ state, version: 0 }))
    await useDesktopUpdateStore.persist.rehydrate()
    expect(useDesktopUpdateStore.getState()).toMatchObject({ frequency: 'weekly', lastCheckedAt: null, lastNotifiedVersion: null })
  })

  it('shares an in-flight request and remembers only a successful check', async () => {
    let finish!: (value: typeof info) => void
    check.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const first = checkAndRememberDesktopUpdate()
    const second = checkAndRememberDesktopUpdate()
    expect(check).toHaveBeenCalledOnce()
    expect(useDesktopUpdateStore.getState().lastCheckedAt).toBeNull()
    finish(info)
    expect(await first).toEqual(info)
    expect(await second).toEqual(info)
    const lastCheckedAt = useDesktopUpdateStore.getState().lastCheckedAt
    expect(lastCheckedAt).toBeTypeOf('number')
    check.mockRejectedValueOnce(new Error('offline'))
    await expect(checkAndRememberDesktopUpdate()).rejects.toThrow('offline')
    expect(useDesktopUpdateStore.getState().lastCheckedAt).toBe(lastCheckedAt)
    check.mockResolvedValueOnce(info)
    await expect(checkAndRememberDesktopUpdate()).resolves.toEqual(info)
    expect(check).toHaveBeenCalledTimes(3)
  })
})
