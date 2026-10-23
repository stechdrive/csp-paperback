import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExportSettingsPopover } from '../../components/ExportSettingsPopover'
import { PreviewPanel } from '../../components/PreviewPanel'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS } from '../../types'

vi.mock('../../utils/clip-io', () => ({ readClipFile: vi.fn() }))

const runtime = vi.hoisted(() => ({ desktop: false }))

vi.mock('../../platform/runtime', () => ({
  isDesktopRuntime: () => runtime.desktop,
}))

beforeEach(() => {
  runtime.desktop = false
  useAppStore.setState({
    docWidth: 0,
    docHeight: 0,
    timelineData: null,
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
  ])('%s版の起動直後は案内を表示し、書き出し設定をペイン内に重複させない', (_label, desktop) => {
    runtime.desktop = desktop
    render(<PreviewPanel />)

    const guide = screen.getByTestId('startup-guide-scroll')
    expect(screen.queryByTestId('export-settings')).not.toBeInTheDocument()
    expect(within(guide).getByText('フレーム枠線・タップ画像を各セルに合成')).toBeInTheDocument()
    expect(within(guide).getByText('背景原図・撮影指示を単独で書き出す')).toBeInTheDocument()
    expect(within(guide).queryByText('書き出し設定を決める')).not.toBeInTheDocument()
    expect(guide.textContent).not.toContain('XDTS')
    expect(guide.textContent).toContain('CLIPファイルをここにドロップ')
    expect(guide.textContent).toContain('ベクターレイヤー・3Dレイヤーの描画をクリスタに合わせるには')
    expect(within(guide).getByText('保存済みのCLIPで互換情報の保存を後からONにした場合、通常の［保存］（Ctrl+S）だけでは反映されません。').tagName).toBe('STRONG')
    expect(guide.textContent).toContain('［ファイル］→［別名で保存］でCLIPを保存')
    expect(guide.textContent).toContain('その保存画面で元のCLIPを選んで上書き')
    expect(guide.textContent).not.toContain('複製を保存')
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
    render(<ExportSettingsPopover />)
    fireEvent.click(screen.getByRole('button', { name: '書き出し設定' }))
    const settings = screen.getByRole('dialog', { name: '書き出し設定' })
    expect(within(settings).getByRole('switch', { name: 'フォルダ分け' })).toBeChecked()
    fireEvent.click(within(settings).getByRole('switch', { name: '修正ラベル' }))

    expect(useAppStore.getState().savedOutputConfig.revisionBorderEnabled).toBe(false)
    expect(useAppStore.getState().outputConfig.revisionBorderEnabled).toBe(true)
  })
})
