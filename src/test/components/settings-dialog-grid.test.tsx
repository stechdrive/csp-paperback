import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
  it('グループ名を確定時に一度だけ保存し、Undo/Redoと空欄の初期値復帰に対応する', () => {
    render(<SettingsDialog onClose={vi.fn()} />)
    const input = screen.getByLabelText('工程に属さないセル画像のグループ名')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '原' } })
    fireEvent.change(input, { target: { value: ' 原画 ' } })
    expect(useAppStore.getState().projectSettings.bodyGroupName).toBe('作画')
    expect(useAppStore.getState()._past).toHaveLength(0)
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(useAppStore.getState()._past).toHaveLength(0)
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    expect(input).toHaveValue('原画')
    expect(useAppStore.getState()._past).toHaveLength(1)
    act(() => useAppStore.getState().undo())
    expect(input).toHaveValue('作画')
    act(() => useAppStore.getState().redo())
    expect(input).toHaveValue('原画')
    fireEvent.change(input, { target: { value: '  ' } })
    fireEvent.blur(input)
    expect(input).toHaveValue('作画')
    expect(useAppStore.getState()._past).toHaveLength(2)
  })

  it('入力のEscapeだけを取り消し、ダイアログの完了時には未確定の名前を保存する', () => {
    const close = vi.fn()
    render(<SettingsDialog onClose={close} />)
    const input = screen.getByLabelText('工程に属さないセル画像のグループ名')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '取消' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)
    expect(input).toHaveValue('作画')
    expect(close).not.toHaveBeenCalled()
    expect(useAppStore.getState()._past).toHaveLength(0)
    fireEvent.change(input, { target: { value: '動画' } })
    fireEvent.click(screen.getByRole('button', { name: '完了' }))
    expect(close).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().projectSettings.bodyGroupName).toBe('動画')
    expect(useAppStore.getState()._past).toHaveLength(1)
  })

  it('工程・テンプレートのヘルプから、入力内容を保った詳細設定へ戻る', () => {
    render(<SettingsDialog onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('グループ名 1'), { target: { value: '演出チェック' } })
    for (const [link, tab] of [['工程の分け方を見る', /機能ガイド/], ['各社テンプレートの例を見る', /各社テンプレートへの対応/]] as const) {
      fireEvent.click(screen.getByRole('button', { name: link }))
      const help = screen.getByRole('dialog', { name: 'CSP Paperback ヘルプ' })
      expect(within(help).getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true')
      fireEvent.click(within(help).getByRole('button', { name: 'ヘルプを閉じる' }))
      expect(screen.getByLabelText('グループ名 1')).toHaveValue('演出チェック')
    }
  })

  it('工程の表示名だけを編集して、設定JSONへ保存し、Undoできる', () => {
    render(<SettingsDialog onClose={vi.fn()} />)
    const original = useAppStore.getState().projectSettings.processTable[0]
    fireEvent.change(screen.getByLabelText('グループ名 1'), { target: { value: '演出チェック' } })
    const updated = useAppStore.getState().projectSettings.processTable[0]
    expect(updated).toEqual({ ...original, displayName: '演出チェック' })
    expect(JSON.parse(useAppStore.getState().exportSettings()).processTable[0].displayName).toBe('演出チェック')
    useAppStore.getState().undo()
    expect(useAppStore.getState().projectSettings.processTable[0]).toEqual(original)
  })

  it('読み込み時の表示設定を変えても現在の表示状態を変更しない', () => {
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
