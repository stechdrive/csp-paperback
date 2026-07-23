import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PreviewPanel } from '../../components/PreviewPanel'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS } from '../../types'

const runtime = vi.hoisted(() => ({ desktop: false }))

vi.mock('../../platform/runtime', () => ({
  isDesktopRuntime: () => runtime.desktop,
}))

beforeEach(() => {
  runtime.desktop = false
  useAppStore.setState({
    docWidth: 0,
    docHeight: 0,
    xdtsData: null,
    xdtsFileName: null,
    layerTree: [],
    unmatchedTracks: [],
    outputConfig: { ...DEFAULT_OUTPUT_CONFIG },
    savedOutputConfig: {
      ...DEFAULT_OUTPUT_CONFIG,
      format: 'png',
      background: 'transparent',
      structure: 'hierarchy',
    },
    projectSettings: {
      ...DEFAULT_PROJECT_SETTINGS,
      processTable: DEFAULT_PROJECT_SETTINGS.processTable.map(entry => ({
        ...entry,
        folderNames: [...entry.folderNames],
      })),
      autoMarkFolderNames: [...DEFAULT_PROJECT_SETTINGS.autoMarkFolderNames],
      archivePatterns: [...DEFAULT_PROJECT_SETTINGS.archivePatterns],
    },
  })
})

afterEach(cleanup)

describe('PreviewPanel startup layout', () => {
  it.each([
    ['Web', false],
    ['デスクトップ', true],
  ])('%s版の起動直後は書き出し設定を上部に固定し、案内を別領域に置く', (_label, desktop) => {
    runtime.desktop = desktop
    render(<PreviewPanel />)

    const settings = screen.getByTestId('startup-export-settings')
    const guide = screen.getByTestId('startup-guide-scroll')
    expect(settings.nextElementSibling).toBe(guide)
    expect(within(settings).getByText('書き出し設定')).toBeInTheDocument()
    expect(within(settings).queryByText(/クイック書き出し/)).not.toBeInTheDocument()
    expect(within(settings).getByRole('switch', { name: 'フォルダ分け' }))
      .toHaveAttribute('aria-checked', 'true')
    expect(within(guide).getByText('書き出し設定を決める')).toBeInTheDocument()
    expect(within(guide).getByText('「出力」から保存方法を選ぶ')).toBeInTheDocument()
    expect(guide.textContent).toContain('同じCLIPファイルから')
    expect(guide.textContent).toContain('2ファイルを、まとめて画面へドロップ')
    expect(within(guide).queryByText('最初の1回はここだけ')).not.toBeInTheDocument()
    expect(within(guide).queryByText('起動時に見えている設定')).not.toBeInTheDocument()
    expect(within(guide).queryByText('サンプル作画テンプレート(.clip)')).not.toBeInTheDocument()

    const desktopDownload = within(guide).queryByRole('link', {
      name: 'デスクトップ版をダウンロード',
    })
    if (desktop) {
      expect(desktopDownload).not.toBeInTheDocument()
    } else {
      expect(desktopDownload).toHaveAttribute(
        'href',
        'https://github.com/stechdrive/csp-paperback/releases',
      )
      expect(desktopDownload).toHaveAttribute('target', '_blank')
    }
  })

  it('起動画面の操作は現在値ではなく保存済み書き出し設定へ反映する', () => {
    render(<PreviewPanel />)

    const settings = screen.getByTestId('startup-export-settings')
    fireEvent.click(within(settings).getByRole('switch', { name: '修正工程' }))

    expect(useAppStore.getState().savedOutputConfig.revisionBorderEnabled).toBe(false)
    expect(useAppStore.getState().outputConfig.revisionBorderEnabled).toBe(true)
  })
})
