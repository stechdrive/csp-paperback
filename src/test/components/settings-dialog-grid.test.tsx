import { cleanup, render, screen } from '@testing-library/react'
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
