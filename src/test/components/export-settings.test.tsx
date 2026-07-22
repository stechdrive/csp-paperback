import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExportSettings } from '../../components/ExportSettings'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS } from '../../types'

beforeEach(() => {
  useAppStore.setState({
    layerTree: [],
    unmatchedTracks: [],
    outputConfig: { ...DEFAULT_OUTPUT_CONFIG },
    savedOutputConfig: { ...DEFAULT_OUTPUT_CONFIG },
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

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ExportSettings naming controls', () => {
  it('起動画面では保存済み設定を表示し、その設定だけを変更する', () => {
    useAppStore.setState({
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, revisionBorderEnabled: true },
      savedOutputConfig: {
        ...DEFAULT_OUTPUT_CONFIG,
        format: 'png',
        background: 'transparent',
        structure: 'hierarchy',
        revisionBorderEnabled: true,
      },
    })

    render(<ExportSettings configTarget="saved" />)

    expect(screen.getByRole('button', { name: '透明（PNG のみ）' })).toHaveAttribute('aria-disabled', 'false')
    expect(screen.getByRole('switch', { name: 'フォルダ分け' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('switch', { name: '修正工程' }))
    expect(useAppStore.getState().savedOutputConfig.revisionBorderEnabled).toBe(false)
    expect(useAppStore.getState().savedOutputConfig.format).toBe('png')
    expect(useAppStore.getState().outputConfig.revisionBorderEnabled).toBe(true)
  })

  it('修正工程フチを中央ペインでオンオフできる', () => {
    render(<ExportSettings />)

    const toggle = screen.getByRole('switch', { name: '修正工程' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('フチあり')).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(useAppStore.getState().outputConfig.revisionBorderEnabled).toBe(false)
    expect(useAppStore.getState().savedOutputConfig.revisionBorderEnabled).toBe(false)
    expect(screen.getByText('フチなし')).toBeInTheDocument()
  })

  it('シート連番・自動桁数・区切りなしを初期選択し、サンプルへ反映する', () => {
    render(<ExportSettings />)

    expect(useAppStore.getState().projectSettings.cellNamingMode).toBe('sheet-sequence')
    expect(useAppStore.getState().projectSettings.sequenceDigitMode).toBe('auto')
    expect(useAppStore.getState().projectSettings.cellPrefixSeparator).toBe('none')
    expect(screen.getByText('A1_e.jpg')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '4桁' }))
    expect(useAppStore.getState().projectSettings.sequenceDigitMode).toBe('fixed-4')
    expect(screen.getByText('A0001_e.jpg')).toBeInTheDocument()
  })

  it('アニメーションフォルダ名とセル部分の区切りを省略できる', () => {
    render(<ExportSettings />)

    fireEvent.click(screen.getByRole('button', { name: '_ あり' }))
    expect(useAppStore.getState().projectSettings.cellPrefixSeparator).toBe('underscore')
    expect(useAppStore.getState().projectSettings.animationSequenceSeparator).toBe('underscore')
    expect(screen.getByText('A_1_e.jpg')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'なし' }))
    expect(useAppStore.getState().projectSettings.cellPrefixSeparator).toBe('none')
    expect(useAppStore.getState().projectSettings.animationSequenceSeparator).toBe('none')
    expect(screen.getByText('A1_e.jpg')).toBeInTheDocument()
  })

  it('セル名出力では連番桁数だけを無効化し、区切りを操作できる', () => {
    render(<ExportSettings />)

    fireEvent.click(screen.getByRole('button', { name: 'セル名' }))
    const autoButton = screen.getByRole('button', { name: '自動' })
    const fixedButton = screen.getByRole('button', { name: '4桁' })
    const underscoreButton = screen.getByRole('button', { name: '_ あり' })
    const noSeparatorButton = screen.getByRole('button', { name: 'なし' })
    for (const button of [autoButton, fixedButton]) {
      expect(button).toHaveAttribute('aria-disabled', 'true')
    }
    expect(underscoreButton).not.toHaveAttribute('aria-disabled')
    expect(noSeparatorButton).not.toHaveAttribute('aria-disabled')

    fireEvent.click(fixedButton)
    fireEvent.click(noSeparatorButton)
    expect(useAppStore.getState().projectSettings.sequenceDigitMode).toBe('auto')
    expect(useAppStore.getState().projectSettings.cellPrefixSeparator).toBe('none')
    expect(screen.getByText('A1_e.jpg')).toBeInTheDocument()
  })

  it('XDTSフォルダ名はセル名モードでだけ変更でき、出力例へ反映する', () => {
    render(<ExportSettings />)

    const toggle = screen.getByRole('switch', { name: 'XDTSフォルダ名' })
    expect(toggle).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(toggle)
    expect(useAppStore.getState().projectSettings.includeXdtsTrackPrefixInCellName).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'セル名' }))
    expect(toggle).toHaveAttribute('aria-disabled', 'false')
    expect(screen.getByText('A1_e.jpg')).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(useAppStore.getState().projectSettings.includeXdtsTrackPrefixInCellName).toBe(false)
    expect(screen.getByText('1_e.jpg')).toBeInTheDocument()
  })

  it('出力例とスイッチ群を独立した段に置き、切り替えてもスイッチ要素を移動しない', () => {
    render(<ExportSettings />)

    const grid = screen.getByTestId('export-option-switch-grid')
    const sampleRow = screen.getByTestId('name-sample-row')
    const xdtsPrefixOption = screen.getByTestId('xdts-track-prefix-option')
    const initialItems = Array.from(grid.children)
    expect(initialItems).toHaveLength(4)
    expect(initialItems.map(item => item.getAttribute('data-switch-option'))).toEqual([
      'shared-cut',
      'structure',
      'process-position',
      'revision-border',
    ])
    expect(grid.contains(sampleRow)).toBe(false)

    fireEvent.click(screen.getByRole('switch', { name: '兼用カット' }))
    fireEvent.click(screen.getByRole('switch', { name: 'フォルダ分け' }))
    fireEvent.click(screen.getByRole('switch', { name: '工程名の位置' }))
    fireEvent.click(screen.getByRole('switch', { name: '修正工程' }))
    fireEvent.click(screen.getByRole('button', { name: 'セル名' }))
    fireEvent.click(screen.getByRole('switch', { name: 'XDTSフォルダ名' }))

    expect(screen.getByTestId('export-option-switch-grid')).toBe(grid)
    expect(Array.from(grid.children)).toEqual(initialItems)
    expect(screen.getByTestId('xdts-track-prefix-option')).toBe(xdtsPrefixOption)
  })

  it('中央ペインの各選択肢にユーザー向けツールチップを表示する', () => {
    vi.useFakeTimers()
    render(<ExportSettings />)

    const transparentButton = screen.getByRole('button', { name: '透明（PNG のみ）' })
    expect(transparentButton).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(transparentButton)
    expect(useAppStore.getState().outputConfig.background).toBe('white')

    const cases = [
      ['JPG', 'ファイルサイズを抑えて、一般的な画像ソフトで扱いやすいJPGで書き出します。透明背景は使えません。'],
      ['PNG', '線や色を劣化させずにPNGで書き出します。透明背景を使いたい場合はこちらを選びます。'],
      ['白ベタ', '透明な部分を白で埋めて書き出します。JPGとPNGのどちらでも使えます。'],
      ['透明（PNG のみ）', '透明な部分を残したまま書き出します。PNGを選んでいるときだけ使えます。'],
      ['連番', 'フォルダ内のセルへ1、2…の順番で番号を付けます。桁数は出力する最大番号に合わせます。'],
      ['連番セル名', /A1_ア\.jpgのように、連番とクリスタのセル名を両方付けます/],
      ['セル名', 'クリスタのセル名を使います。A1 / A_1のようにアニメーションフォルダ名から始まるセルは、同じフォルダ名を重ねて付けません。'],
      ['シート連番', /XDTSのタイムライン順に番号を付け/],
      ['自動', '出力する最大番号に合わせて桁数を自動調整します。1〜9は1桁、10〜99は2桁になります。'],
      ['4桁', 'すべて0001、0002…の4桁で書き出します。'],
      ['_ あり', /セル名が「1」の場合 A_1\.jpgになります。/],
      ['なし', /セル名が「1」の場合 A1\.jpgになります。/],
      ['全ON', 'すべての修正工程と自動マーク素材を書き出し対象にします。'],
      ['全OFF', 'すべての修正工程と自動マーク素材を書き出し対象から外します。'],
    ] as const

    for (const [name, hint] of cases) {
      const control = screen.getByRole('button', { name })
      fireEvent.mouseEnter(control)
      act(() => vi.advanceTimersByTime(300))
      expect(screen.getByText(hint)).toBeInTheDocument()
      fireEvent.mouseLeave(control)
    }

    const switchCases = [
      ['XDTSフォルダ名', /セル名が「1」のように.*セル名が「A1」のように.*「付けない」を選びます。/s],
      ['兼用カット', /OFF: このカットで使うセルだけを書き出します。/],
      ['フォルダ分け', /すべて出力先の直下へまとめます。/],
      ['工程名の位置', /工程名をセル番号の前に付けます/],
      ['修正工程', /OFF: 修正工程は出力しますが、フチは付けません。/],
    ] as const

    for (const [name, hint] of switchCases) {
      const control = screen.getByRole('switch', { name })
      fireEvent.mouseEnter(control)
      act(() => vi.advanceTimersByTime(300))
      expect(screen.getByText(hint)).toBeInTheDocument()
      fireEvent.mouseLeave(control)
    }

    fireEvent.click(screen.getByRole('button', { name: 'セル名' }))
    const unavailableAuto = screen.getByRole('button', { name: '自動' })
    fireEvent.mouseEnter(unavailableAuto)
    act(() => vi.advanceTimersByTime(300))
    expect(screen.getByText('セル名出力ではクリスタのセル名を使うため、連番桁数は適用されません。連番・連番セル名・シート連番で使えます。')).toBeInTheDocument()
    fireEvent.mouseLeave(unavailableAuto)
  })
})
