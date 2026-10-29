import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkDesktopUpdate, compareSemver, GITHUB_LATEST_RELEASE_API_URL } from '../../platform/update-check'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('checkDesktopUpdate', () => {
  it.each([['v999.1.2', true], [`v${__APP_VERSION__}`, false], ['v0.0.1', false]])('compares release %s with the installed version', async (tag, hasUpdate) => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tag_name: tag }) })
    vi.stubGlobal('fetch', fetch)
    expect(await checkDesktopUpdate()).toEqual({ currentVersion: __APP_VERSION__, latestVersion: tag.slice(1), hasUpdate })
    expect(fetch).toHaveBeenCalledWith(GITHUB_LATEST_RELEASE_API_URL, expect.objectContaining({ credentials: 'omit', cache: 'no-store' }))
  })

  it.each([null, {}, { tag_name: 123 }, { tag_name: 'v1.2.3-beta' }])('rejects malformed release data: %j', async release => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => release }))
    await expect(checkDesktopUpdate()).rejects.toThrow()
  })

  it('rejects HTTP failure and times out a stalled request', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    await expect(checkDesktopUpdate()).rejects.toThrow('403')
    expect(vi.getTimerCount()).toBe(0)
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')))
    })))
    const result = expect(checkDesktopUpdate()).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(10_000)
    await result
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('compareSemver', () => {
  it('compares equal versions', () => {
    expect(compareSemver('1.2.3', 'v1.2.3')).toBe(0)
  })

  it('compares patch, minor, and major versions', () => {
    expect(compareSemver('1.2.4', '1.2.3')).toBe(1)
    expect(compareSemver('1.3.0', '1.2.99')).toBe(1)
    expect(compareSemver('2.0.0', '1.99.99')).toBe(1)
    expect(compareSemver('1.2.3', '1.2.4')).toBe(-1)
  })

  it('rejects non plain semver values', () => {
    expect(() => compareSemver('1.2', '1.2.0')).toThrow()
    expect(() => compareSemver('1.2.3-beta.1', '1.2.0')).toThrow()
  })
})
