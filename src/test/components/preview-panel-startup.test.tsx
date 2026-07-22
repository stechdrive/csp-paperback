import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PreviewPanel } from '../../components/PreviewPanel'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS } from '../../types'

vi.mock('../../platform/runtime', () => ({
  isDesktopRuntime: () => true,
}))

beforeEach(() => {
  useAppStore.setState({
    docWidth: 0,
    docHeight: 0,
    xdtsData: null,
    xdtsFileName: null,
    layerTree: [],
    unmatchedTracks: [],
    outputConfig: { ...DEFAULT_OUTPUT_CONFIG },
    quickExportConfig: {
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
  it('デスクトップ起動直後はクイック設定を上部に固定し、案内を別領域に置く', () => {
    render(<PreviewPanel />)

    const quickSettings = screen.getByTestId('startup-quick-export-settings')
    const guide = screen.getByTestId('startup-guide-scroll')
    expect(quickSettings.nextElementSibling).toBe(guide)
    expect(within(quickSettings).getByText('⚡ クイック書き出し設定')).toBeInTheDocument()
    expect(within(quickSettings).getByRole('switch', { name: 'フォルダ分け' }))
      .toHaveAttribute('aria-checked', 'true')
    expect(within(guide).getByText('はじめに — ClipStudioPaint 側の準備')).toBeInTheDocument()
  })

  it('起動画面の操作は通常出力ではなくクイック書き出し設定へ反映する', () => {
    render(<PreviewPanel />)

    const quickSettings = screen.getByTestId('startup-quick-export-settings')
    fireEvent.click(within(quickSettings).getByRole('switch', { name: '修正工程' }))

    expect(useAppStore.getState().quickExportConfig.revisionBorderEnabled).toBe(false)
    expect(useAppStore.getState().outputConfig.revisionBorderEnabled).toBe(true)
  })
})
