import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExportSettings } from '../../components/ExportSettings'
import { useAppStore } from '../../store'
import { selectOutputFiles, selectOutputNavigation } from '../../store/selectors'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS } from '../../types'
import { buildLayerTree } from '../../engine/tree-builder'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'

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

    fireEvent.click(screen.getByRole('switch', { name: '修正ラベル' }))
    expect(useAppStore.getState().savedOutputConfig.revisionBorderEnabled).toBe(false)
    expect(useAppStore.getState().savedOutputConfig.format).toBe('png')
    expect(useAppStore.getState().outputConfig.revisionBorderEnabled).toBe(true)
  })

  it('修正工程フチを中央ペインでオンオフできる', () => {
    render(<ExportSettings />)

    const toggle = screen.getByRole('switch', { name: '修正ラベル' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('revision-label-sample')).toHaveAttribute('data-enabled', 'true')

    fireEvent.click(toggle)
    expect(useAppStore.getState().outputConfig.revisionBorderEnabled).toBe(false)
    expect(useAppStore.getState().savedOutputConfig.revisionBorderEnabled).toBe(false)
    expect(screen.getByTestId('revision-label-sample')).toHaveAttribute('data-enabled', 'false')
  })

  it('検出した工程と素材を個別に選び、OFF後も選択肢が残り、修正ラベルと独立する', () => {
    const tree = buildLayerTree(makePsd({ children: [
      makeFolder('演出', [makeFolder('A', [makeLayer({ name: '001' })])]),
      makeFolder('_SL', [makeLayer()]),
    ] }))
    const anim = tree.find(l => l.originalName === '演出')!.children[0]
    useAppStore.setState({ layerTree: tree, manualAnimFolderIds: new Set([anim.id]) })
    render(<ExportSettings />)
    const targets = screen.getByRole('group', { name: '出力対象' })
    const direction = within(targets).getByRole('button', { name: '演出' })
    const autoMarked = within(targets).getByRole('button', { name: 'SL 個別書き出し' })
    expect(within(targets).queryByRole('button', { name: '作監' })).not.toBeInTheDocument()
    expect(within(targets).queryByRole('button', { name: '作画' })).not.toBeInTheDocument()
    expect(direction).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(direction)
    fireEvent.click(autoMarked)
    expect(direction).toHaveAttribute('aria-pressed', 'false')
    expect(useAppStore.getState().outputConfig.excludedProcessSuffixes).toEqual(['_e'])
    expect(useAppStore.getState().outputConfig.individualOutputOverrides).toEqual({ sl: false })
    expect(screen.getByRole('switch', { name: '修正ラベル' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('switch', { name: '修正ラベル' }))
    expect(useAppStore.getState().outputConfig.excludedProcessSuffixes).toEqual(['_e'])
    expect(autoMarked).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: '全ON' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '全OFF' })).not.toBeInTheDocument()
  })

  it('旧設定で除外した工程名の個別素材を復元し、工程チェックからまとめて再開できる', () => {
    const tree = buildLayerTree(makePsd({ children: [
      makeFolder('_e', [makeLayer()]),
      makeFolder('演出', [makeFolder('A', [makeLayer({ name: '001' })])]),
      makeFolder('_SL', [makeLayer()]),
    ] }))
    const anim = tree.find(layer => layer.originalName === '演出')!.children[0]
    const oldMaterial = tree.find(layer => layer.originalName === '_e')!
    useAppStore.setState({ layerTree: tree, docWidth: 100, docHeight: 100,
      manualAnimFolderIds: new Set([anim.id]), singleMarks: new Map(), visibilityOverrides: new Map(),
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, excludeAutoMarked: true } })
    render(<ExportSettings />)
    const direction = screen.getByRole('button', { name: '演出' })
    const files = () => selectOutputFiles(useAppStore.getState())
    expect(direction).toHaveAttribute('aria-pressed', 'mixed')
    expect(files().some(file => file.sourceLayerId === oldMaterial.id)).toBe(false)
    expect(files()).toHaveLength(1)

    fireEvent.click(direction)
    expect(direction).toHaveAttribute('aria-pressed', 'true')
    expect(files().some(file => file.sourceLayerId === oldMaterial.id)).toBe(true)
    expect(files()).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'SL 個別書き出し' })).toHaveAttribute('aria-pressed', 'false')
    expect(selectOutputNavigation(useAppStore.getState()).entries.map(entry => entry.id).sort())
      .toEqual(files().map(file => file.sourceLayerId).sort())
    act(() => useAppStore.getState().undo())
    expect(direction).toHaveAttribute('aria-pressed', 'mixed')
    expect(files()).toHaveLength(1)
    fireEvent.click(direction)
    fireEvent.click(direction)
    expect(direction).toHaveAttribute('aria-pressed', 'false')
    expect(files()).toHaveLength(0)
  })

  it('セル名・フォルダ名付加・区切りありを初期選択し、連番へ切り替えると桁数を選べる', () => {
    render(<ExportSettings />)

    expect(useAppStore.getState().projectSettings.cellNamingMode).toBe('cellname')
    expect(useAppStore.getState().projectSettings.sequenceDigitMode).toBe('auto')
    expect(useAppStore.getState().projectSettings.cellPrefixSeparator).toBe('underscore')
    expect(screen.getByRole('switch', { name: 'アニメーションフォルダ名' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('出力例: A_1_e.jpg')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '連番（シート合わせ）' }))
    fireEvent.click(screen.getByRole('button', { name: '4桁' }))
    expect(useAppStore.getState().projectSettings.sequenceDigitMode).toBe('fixed-4')
    expect(screen.getByLabelText('出力例: A_0001_e.jpg')).toBeInTheDocument()
  })

  it('アニメーションフォルダ名とセル部分の区切りを省略できる', () => {
    render(<ExportSettings />)

    fireEvent.click(screen.getByRole('button', { name: '_ あり' }))
    expect(useAppStore.getState().projectSettings.cellPrefixSeparator).toBe('underscore')
    expect(useAppStore.getState().projectSettings.animationSequenceSeparator).toBe('underscore')
    expect(screen.getByLabelText('出力例: A_1_e.jpg')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'なし' }))
    expect(useAppStore.getState().projectSettings.cellPrefixSeparator).toBe('none')
    expect(useAppStore.getState().projectSettings.animationSequenceSeparator).toBe('none')
    expect(screen.getByLabelText('出力例: A1_e.jpg')).toBeInTheDocument()
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
    expect(screen.getByLabelText('出力例: A1_e.jpg')).toBeInTheDocument()
  })

  it('アニメーションフォルダ名はセル名モードでだけ変更でき、出力例へ反映する', () => {
    render(<ExportSettings />)

    fireEvent.click(screen.getByRole('button', { name: '連番（シート合わせ）' }))
    const toggle = screen.getByRole('switch', { name: 'アニメーションフォルダ名' })
    expect(toggle).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(toggle)
    expect(useAppStore.getState().projectSettings.includeXdtsTrackPrefixInCellName).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'セル名' }))
    expect(toggle).toHaveAttribute('aria-disabled', 'false')
    expect(screen.getByLabelText('出力例: A_1_e.jpg')).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(useAppStore.getState().projectSettings.includeXdtsTrackPrefixInCellName).toBe(false)
    expect(screen.getByLabelText('出力例: 1_e.jpg')).toBeInTheDocument()
  })

  it('名前に関わる設定を出力例とまとめ、変更箇所の目印は時間経過やEscapeで消す', () => {
    vi.useFakeTimers()
    render(<ExportSettings />)
    const naming = screen.getByTestId('naming-settings')
    const sampleRow = screen.getByTestId('name-sample-row')
    const part = (name: string) => sampleRow.querySelector(`[data-name-part="${name}"]`)!
    expect(naming).toContainElement(sampleRow)
    expect(within(naming).getByRole('switch', { name: 'フォルダ分け' })).toBeInTheDocument()
    fireEvent.click(within(naming).getByRole('button', { name: '前' }))
    expect(screen.getByLabelText('出力例: A_e_1.jpg')).toBeInTheDocument()
    expect(part('suffix')).toHaveAttribute('data-highlighted', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'なし' }))
    expect(screen.getByLabelText('出力例: A_e1.jpg')).toBeInTheDocument()
    expect(part('separator')).toHaveAttribute('data-highlighted', 'true')
    expect(part('separator')).toBeEmptyDOMElement()
    fireEvent.click(screen.getByRole('button', { name: 'PNG' }))
    expect(screen.getByLabelText('出力例: A_e1.png')).toBeInTheDocument()
    expect(part('extension')).toHaveAttribute('data-highlighted', 'true')
    act(() => vi.advanceTimersByTime(1200))
    expect(part('extension')).toHaveAttribute('data-highlighted', 'false')
    fireEvent.click(part('prefix'))
    expect(screen.getByTestId('xdts-track-prefix-option')).toHaveAttribute('data-highlighted', 'true')
    expect(screen.getByRole('switch', { name: 'アニメーションフォルダ名' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('switch', { name: 'アニメーションフォルダ名' }), { key: 'Escape' })
    expect(sampleRow.querySelector('[data-highlighted="true"]')).toBeNull()
    expect(screen.getByTestId('name-sample-row')).toBe(sampleRow)
  })

  it('作監の辞書色を見本に反映し、色の変更や別名・未登録にも対応する', () => {
    render(<ExportSettings />)
    const sample = screen.getByTestId('revision-label-sample')
    expect(sample.style.getPropertyValue('--revision-color')).toBe('#FCF9CF')
    act(() => useAppStore.getState().updateProcessTable([
      { suffix: '_s', folderNames: ['作監以外'], revisionBorderColor: '#123456' },
      { suffix: '_sak', folderNames: [' 作監 '], revisionBorderColor: '#F0AABB' },
    ]))
    expect(sample.style.getPropertyValue('--revision-color')).toBe('#F0AABB')
    act(() => useAppStore.getState().updateProcessTable([
      { suffix: '_s', folderNames: ['AD'], revisionBorderColor: '#123456' },
    ]))
    expect(sample.style.getPropertyValue('--revision-color')).toBe('#123456')
    act(() => useAppStore.getState().updateProcessTable([]))
    expect(sample.style.getPropertyValue('--revision-color')).toBe('#FCF9CF')
  })

  it('中央ペインの各選択肢にユーザー向けツールチップを表示する', () => {
    vi.useFakeTimers()
    render(<ExportSettings />)
    fireEvent.click(screen.getByRole('button', { name: '連番（シート合わせ）' }))

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
      ['連番＋セル名', /セルのレイヤー名・レイヤーフォルダ名の前に、フォルダ内の順番で番号を付けます。.*A_1_ア\.jpg/s],
      ['セル名', /「1」「2」など、すでに付けた番号もそのまま使えます。.*A_1\.jpg、または「ア」→ A_ア\.jpg/s],
      ['連番（シート合わせ）', /作画と同じフレームから始まる修正に、作画と同じ番号を付けます。.*修正が1枚だけでも、作画に合わせて「2」で書き出します。/s],
      ['自動', '出力する最大番号に合わせて桁数を自動調整します。1〜9は1桁、10〜99は2桁になります。'],
      ['4桁', 'すべて0001、0002…の4桁で書き出します。'],
      ['_ あり', /セル名が「1」の場合 A_1\.jpgになります。/],
      ['なし', /セル名が「1」の場合 A1\.jpgになります。/],
    ] as const

    for (const [name, hint] of cases) {
      const control = screen.getByRole('button', { name })
      fireEvent.mouseEnter(control)
      act(() => vi.advanceTimersByTime(300))
      expect(screen.getByText(hint)).toBeInTheDocument()
      fireEvent.mouseLeave(control)
    }

    const switchCases = [
      ['アニメーションフォルダ名', /ファイル名の先頭にアニメーションフォルダ名を付けます。.*ON：A_1\.jpg／OFF：1\.jpg/s],
      ['兼用カット', /OFF: 選択中のタイムラインで未使用のセルは初期OFFになります。/],
      ['フォルダ分け', /すべて出力先の直下へまとめます。/],
      ['修正ラベル', /CLIP内に色付きの下敷きレイヤーを用意せずに/],
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
    expect(screen.getByText('セル名出力ではクリスタで付けた番号や名前を使うため、連番桁数は適用されません。連番・連番＋セル名・連番（シート合わせ）で使えます。')).toBeInTheDocument()
    fireEvent.mouseLeave(unavailableAuto)
  })
})
