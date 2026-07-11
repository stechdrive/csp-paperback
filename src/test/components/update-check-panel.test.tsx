import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpdateCheckDialog, UpdateCheckPanel } from '../../components/UpdateCheckPanel'
import { checkDesktopUpdate } from '../../platform/update-check'

vi.mock('../../platform/runtime', () => ({
  isDesktopRuntime: () => true,
}))

vi.mock('../../platform/update-check', () => ({
  checkDesktopUpdate: vi.fn(),
}))

vi.mock('../../platform/external-links', () => ({
  openDesktopReleasesPage: vi.fn(),
}))

const mockedCheckDesktopUpdate = vi.mocked(checkDesktopUpdate)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('UpdateCheckPanel', () => {
  it('uses the unified update-check label and reports the result', async () => {
    mockedCheckDesktopUpdate.mockResolvedValue({
      currentVersion: '1.18.198',
      latestVersion: '1.18.198',
      hasUpdate: false,
    })

    render(<UpdateCheckPanel />)
    fireEvent.click(screen.getByRole('button', { name: '更新確認' }))

    expect(await screen.findByText('最新版です。現在の版: v1.18.198')).toBeInTheDocument()
  })

  it('starts checking when opened from the toolbar', async () => {
    mockedCheckDesktopUpdate.mockResolvedValue({
      currentVersion: '1.18.198',
      latestVersion: '1.18.199',
      hasUpdate: true,
    })

    render(<UpdateCheckDialog onClose={vi.fn()} />)

    await waitFor(() => expect(mockedCheckDesktopUpdate).toHaveBeenCalledOnce())
    expect(await screen.findByText(/新しい版 v1\.18\.199 があります/)).toBeInTheDocument()
  })
})
