import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsDialog } from '../../components/SettingsDialog'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS } from '../../types'

beforeEach(() => {
  useAppStore.setState({
    projectSettings: {
      ...DEFAULT_PROJECT_SETTINGS,
      processTable: DEFAULT_PROJECT_SETTINGS.processTable.map(entry => ({
        ...entry,
        folderNames: [...entry.folderNames],
      })),
      autoMarkFolderNames: [...DEFAULT_PROJECT_SETTINGS.autoMarkFolderNames],
      archivePatterns: [...DEFAULT_PROJECT_SETTINGS.archivePatterns],
    },
    outputConfig: { ...DEFAULT_OUTPUT_CONFIG },
    layerTree: [],
    _past: [],
    _future: [],
    canUndo: false,
    canRedo: false,
  })
})

afterEach(() => cleanup())

describe('SettingsDialog process table grid', () => {
  it('工程の表示名だけを編集して、設定JSONへ保存し、Undoできる', () => {
    render(<SettingsDialog onClose={vi.fn()} />)
    const original = useAppStore.getState().projectSettings.processTable[0]
    fireEvent.change(screen.getByLabelText('工程名（表示用） 1'), { target: { value: '演出チェック' } })
    const updated = useAppStore.getState().projectSettings.processTable[0]
    expect(updated).toEqual({ ...original, displayName: '演出チェック' })
    expect(JSON.parse(useAppStore.getState().exportSettings()).processTable[0].displayName).toBe('演出チェック')
    useAppStore.getState().undo()
    expect(useAppStore.getState().projectSettings.processTable[0]).toEqual(original)
  })

  it('読み込み時の表示設定を変えても現在の目玉を変更しない', () => {
    render(<SettingsDialog onClose={vi.fn()} />)
    const eyes = useAppStore.getState().visibilityOverrides
    fireEvent.click(screen.getByRole('checkbox', { name: '対象フォルダを非表示でも表示して読み込む' }))
    expect(useAppStore.getState().projectSettings.showIndividualFoldersOnLoad).toBe(false)
    expect(useAppStore.getState().visibilityOverrides).toBe(eyes)
  })
  it('ヘッダーと全工程行を同じGridコンテナへ配置する', () => {
    render(<SettingsDialog onClose={vi.fn()} />)

    const grid = screen.getByTestId('process-table-grid')
    const rows = grid.querySelectorAll('[data-process-table-row]')

    expect(rows).toHaveLength(DEFAULT_PROJECT_SETTINGS.processTable.length)
    expect(screen.getByText('出力サンプル').parentElement?.parentElement).toBe(grid)
    for (const row of rows) {
      expect(row.parentElement).toBe(grid)
    }
  })
})
