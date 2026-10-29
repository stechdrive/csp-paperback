import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AutomaticUpdateCheck } from '../../components/AutomaticUpdateCheck'
import { UpdateCheckDialog } from '../../components/UpdateCheckPanel'
import { checkDesktopUpdate } from '../../platform/update-check'
import { openDesktopReleasesPage } from '../../platform/external-links'
import { UPDATE_CHECK_WEEK_MS, useDesktopUpdateStore } from '../../store/desktop-update'

const runtime = vi.hoisted(() => ({ desktop: true }))
vi.mock('../../platform/runtime', () => ({ isDesktopRuntime: () => runtime.desktop }))
vi.mock('../../platform/update-check', () => ({ checkDesktopUpdate: vi.fn() }))
vi.mock('../../platform/external-links', () => ({ openDesktopReleasesPage: vi.fn() }))
const check = vi.mocked(checkDesktopUpdate)
const info = { currentVersion: '1.40.313', latestVersion: '1.41.314', hasUpdate: true }
const start = new Date('2026-10-30T00:00:00Z').getTime()
const advance = async (ms = 1001) => { await act(() => vi.advanceTimersByTimeAsync(ms)) }
const wakeAt = async (time: number) => {
  vi.setSystemTime(time)
  await act(async () => { fireEvent.focus(window) })
  await advance(1)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(start)
  vi.resetAllMocks()
  runtime.desktop = true
  useDesktopUpdateStore.setState({ frequency: 'weekly', lastCheckedAt: null, lastNotifiedVersion: null })
  check.mockResolvedValue(info)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.removeItem('csp-paperback:desktop-updates')
})

describe('automatic desktop update checks', () => {
  it('checks once in StrictMode and opens a browser only after the user clicks the release link', async () => {
    render(<StrictMode><AutomaticUpdateCheck busy={false} /></StrictMode>)
    await advance()
    await advance(1)
    expect(check).toHaveBeenCalledOnce()
    expect(screen.getByRole('dialog', { name: '新しいバージョンがあります' })).toBeInTheDocument()
    expect(openDesktopReleasesPage).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'GitHub Releases をブラウザで開く' })) })
    expect(openDesktopReleasesPage).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useDesktopUpdateStore.getState().lastNotifiedVersion).toBe(info.latestVersion)
  })

  it.each(['off', 'web'] as const)('does not request anything when %s', async mode => {
    runtime.desktop = mode !== 'web'
    useDesktopUpdateStore.getState().setFrequency(mode === 'off' ? 'off' : 'weekly')
    render(<AutomaticUpdateCheck busy={false} />)
    await advance(61_000)
    fireEvent.focus(window)
    expect(check).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('checks at the seven-day boundary, including while the app stays open', async () => {
    useDesktopUpdateStore.setState({ lastCheckedAt: start, lastNotifiedVersion: info.latestVersion })
    render(<AutomaticUpdateCheck busy={false} />)
    await advance()
    await wakeAt(start + UPDATE_CHECK_WEEK_MS - 1)
    expect(check).not.toHaveBeenCalled()
    await wakeAt(start + UPDATE_CHECK_WEEK_MS)
    expect(check).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    check.mockResolvedValue({ ...info, latestVersion: '1.41.315' })
    await wakeAt(start + 2 * UPDATE_CHECK_WEEK_MS)
    expect(check).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/新しい版 v1.41.315/)).toBeInTheDocument()
  })

  it('startup checks ignore the weekly timestamp but run once per launch', async () => {
    useDesktopUpdateStore.setState({ frequency: 'startup', lastCheckedAt: start })
    const first = render(<AutomaticUpdateCheck busy={false} />)
    await advance()
    await wakeAt(start + 2 * UPDATE_CHECK_WEEK_MS)
    expect(check).toHaveBeenCalledOnce()
    first.unmount()
    render(<AutomaticUpdateCheck busy={false} />)
    await advance()
    expect(check).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('silently retries a failed weekly check after an hour without recording success', async () => {
    check.mockRejectedValueOnce(new Error('rate limited'))
    render(<AutomaticUpdateCheck busy={false} />)
    await advance()
    expect(useDesktopUpdateStore.getState().lastCheckedAt).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await wakeAt(start + 60 * 60 * 1000)
    expect(check).toHaveBeenCalledOnce()
    await wakeAt(start + 60 * 60 * 1000 + 1000)
    expect(check).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('waits for loading/export and other dialogs to finish before marking the version as notified', async () => {
    const other = document.createElement('dialog')
    document.body.append(other)
    other.showModal()
    const view = render(<AutomaticUpdateCheck busy />)
    await advance()
    expect(check).toHaveBeenCalledOnce()
    expect(useDesktopUpdateStore.getState().lastNotifiedVersion).toBeNull()
    view.rerender(<AutomaticUpdateCheck busy={false} />)
    await advance()
    expect(screen.queryByText(/新しい版/)).not.toBeInTheDocument()
    other.close()
    other.remove()
    await advance()
    expect(screen.getByRole('dialog', { name: '新しいバージョンがあります' })).toBeInTheDocument()
  })

  it('discards an automatic result when disabled during the request', async () => {
    let finish!: (value: typeof info) => void
    check.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    render(<AutomaticUpdateCheck busy={false} />)
    await advance()
    act(() => useDesktopUpdateStore.getState().setFrequency('off'))
    await act(async () => { finish(info) })
    await advance()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useDesktopUpdateStore.getState().lastNotifiedVersion).toBeNull()
  })

  it('keeps manual checking available when off and suppresses an already seen automatic result', async () => {
    useDesktopUpdateStore.setState({ frequency: 'off', lastNotifiedVersion: info.latestVersion })
    render(<UpdateCheckDialog onClose={vi.fn()} />)
    await advance(1)
    expect(check).toHaveBeenCalledOnce()
    expect(screen.getByText(/新しい版 v1.41.314/)).toBeInTheDocument()
  })

  it('does not mark an unseen result as notified when a manual dialog closes before the shared request finishes', async () => {
    let finish!: (value: typeof info) => void
    check.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    render(<AutomaticUpdateCheck busy={false} />)
    await advance()
    const manual = render(<UpdateCheckDialog onClose={vi.fn()} />)
    expect(check).toHaveBeenCalledOnce()
    manual.unmount()
    await act(async () => { finish(info) })
    expect(useDesktopUpdateStore.getState().lastNotifiedVersion).toBeNull()
    await advance(1)
    expect(screen.getByRole('dialog', { name: '新しいバージョンがあります' })).toBeInTheDocument()
    expect(useDesktopUpdateStore.getState().lastNotifiedVersion).toBe(info.latestVersion)
  })

  it('shows nothing when current and waits for network recovery when offline', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    check.mockResolvedValue({ ...info, hasUpdate: false })
    render(<AutomaticUpdateCheck busy={false} />)
    await advance()
    expect(check).not.toHaveBeenCalled()
    online.mockReturnValue(true)
    await act(async () => { fireEvent(window, new Event('online')) })
    await advance()
    expect(check).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
