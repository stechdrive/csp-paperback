import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ExportSettings } from '../../components/ExportSettings'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS } from '../../types'

beforeEach(() => {
  useAppStore.setState({
    layerTree: [],
    unmatchedTracks: [],
    outputConfig: { ...DEFAULT_OUTPUT_CONFIG },
    quickExportConfig: { ...DEFAULT_OUTPUT_CONFIG },
    projectSettings: {
      ...DEFAULT_PROJECT_SETTINGS,
      processTable: DEFAULT_PROJECT_SETTINGS.processTable.map(entry => ({
        ...entry,
        folderNames: [...entry.folderNames],
      })),
      autoMarkFolderNames: [...DEFAULT_PROJECT_SETTINGS.autoMarkFolderNames],
      archivePatterns: [...DEFAULT_PROJECT_SETTINGS.archivePatterns],
    },
    _past: [],
    _future: [],
    canUndo: false,
    canRedo: false,
  })
})

afterEach(() => cleanup())

describe('ExportSettings naming controls', () => {
  it('中央ペインの頻用設定として自動桁数を初期選択し、サンプルへ反映する', () => {
    render(<ExportSettings />)

    expect(useAppStore.getState().projectSettings.sequenceDigitMode).toBe('auto')
    expect(screen.getByText('A_01_e.jpg')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '4桁' }))
    expect(useAppStore.getState().projectSettings.sequenceDigitMode).toBe('fixed-4')
    expect(screen.getByText('A_0001_e.jpg')).toBeInTheDocument()
  })

  it('アニメーションフォルダ名と連番の区切りを省略できる', () => {
    render(<ExportSettings />)

    fireEvent.click(screen.getByRole('button', { name: 'なし' }))
    expect(useAppStore.getState().projectSettings.animationSequenceSeparator).toBe('none')
    expect(screen.getByText('A01_e.jpg')).toBeInTheDocument()
  })

  it('セル名出力では連番専用オプションを隠す', () => {
    render(<ExportSettings />)

    fireEvent.click(screen.getByRole('button', { name: 'セル名' }))
    expect(screen.queryByRole('button', { name: '自動' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '4桁' })).not.toBeInTheDocument()
    expect(screen.getByText('A_ア_e.jpg')).toBeInTheDocument()
  })
})
