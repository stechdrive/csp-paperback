import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../store'
import { DEFAULT_PROJECT_SETTINGS } from '../../types'

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
    _past: [],
    _future: [],
    canUndo: false,
    canRedo: false,
  })
})

describe('project-slice - auto mark folder names', () => {
  it('連番桁数は自動、フォルダ名との区切りはアンダースコアをデフォルトにする', () => {
    expect(useAppStore.getState().projectSettings.sequenceDigitMode).toBe('auto')
    expect(useAppStore.getState().projectSettings.cellPrefixSeparator).toBe('underscore')
    expect(useAppStore.getState().projectSettings.animationSequenceSeparator).toBe('underscore')
    expect(useAppStore.getState().projectSettings.includeXdtsTrackPrefixInCellName).toBe(true)
  })

  it('命名設定の変更をUndo/Redoできる', () => {
    useAppStore.getState().setSequenceDigitMode('fixed-4')
    useAppStore.getState().setCellPrefixSeparator('none')
    useAppStore.getState().setIncludeXdtsTrackPrefixInCellName(false)
    expect(useAppStore.getState().projectSettings.sequenceDigitMode).toBe('fixed-4')
    expect(useAppStore.getState().projectSettings.cellPrefixSeparator).toBe('none')
    expect(useAppStore.getState().projectSettings.animationSequenceSeparator).toBe('none')
    expect(useAppStore.getState().projectSettings.includeXdtsTrackPrefixInCellName).toBe(false)

    useAppStore.getState().undo()
    expect(useAppStore.getState().projectSettings.includeXdtsTrackPrefixInCellName).toBe(true)
    useAppStore.getState().undo()
    expect(useAppStore.getState().projectSettings.cellPrefixSeparator).toBe('underscore')
    expect(useAppStore.getState().projectSettings.animationSequenceSeparator).toBe('underscore')
    useAppStore.getState().undo()
    expect(useAppStore.getState().projectSettings.sequenceDigitMode).toBe('auto')
    useAppStore.getState().redo()
    useAppStore.getState().redo()
    useAppStore.getState().redo()
    expect(useAppStore.getState().projectSettings.sequenceDigitMode).toBe('fixed-4')
    expect(useAppStore.getState().projectSettings.cellPrefixSeparator).toBe('none')
    expect(useAppStore.getState().projectSettings.animationSequenceSeparator).toBe('none')
    expect(useAppStore.getState().projectSettings.includeXdtsTrackPrefixInCellName).toBe(false)
  })

  it('撮影指示と原図をデフォルト登録する', () => {
    expect(useAppStore.getState().projectSettings.autoMarkFolderNames).toEqual(['撮影指示', '原図'])
  })

  it('既定工程に指定されたRGB色を登録する', () => {
    const colors = Object.fromEntries(
      useAppStore.getState().projectSettings.processTable
        .map(entry => [entry.folderNames[1], entry.revisionBorderColor]),
    )
    expect(colors).toMatchObject({
      演出: '#FBECE6',
      監督: '#DCE4F1',
      作監: '#FCF9CF',
      総作監: '#EAF6D5',
      料理作監: '#FFDDAA',
    })
  })

  it('登録名の変更をUndo/Redoできる', () => {
    useAppStore.getState().updateAutoMarkFolderNames(['BOOK'])
    expect(useAppStore.getState().projectSettings.autoMarkFolderNames).toEqual(['BOOK'])

    useAppStore.getState().undo()
    expect(useAppStore.getState().projectSettings.autoMarkFolderNames).toEqual(['撮影指示', '原図'])

    useAppStore.getState().redo()
    expect(useAppStore.getState().projectSettings.autoMarkFolderNames).toEqual(['BOOK'])
  })

  it('旧形式JSONの読み込みではデフォルト登録名を補う', () => {
    useAppStore.getState().importSettings(JSON.stringify({
      processTable: [],
      cellNamingMode: 'sequence',
      archivePatterns: ['_old'],
    }))

    expect(useAppStore.getState().projectSettings.autoMarkFolderNames).toEqual(['撮影指示', '原図'])
    expect(useAppStore.getState().projectSettings.sequenceDigitMode).toBe('auto')
    expect(useAppStore.getState().projectSettings.cellPrefixSeparator).toBe('underscore')
    expect(useAppStore.getState().projectSettings.animationSequenceSeparator).toBe('underscore')
    expect(useAppStore.getState().projectSettings.includeXdtsTrackPrefixInCellName).toBe(true)
  })

  it('旧連番区切り設定をフォルダ名との区切りへ移行する', () => {
    useAppStore.getState().importSettings(JSON.stringify({
      processTable: [],
      cellNamingMode: 'cellname',
      animationSequenceSeparator: 'none',
      archivePatterns: [],
    }))

    expect(useAppStore.getState().projectSettings.cellPrefixSeparator).toBe('none')
    expect(useAppStore.getState().projectSettings.animationSequenceSeparator).toBe('none')
    expect(useAppStore.getState().projectSettings.includeXdtsTrackPrefixInCellName).toBe(true)
  })

  it('色を持たない旧形式の工程テーブルへ既定色を補う', () => {
    useAppStore.getState().importSettings(JSON.stringify({
      processTable: [{ suffix: '_sak', folderNames: ['作監'] }],
      cellNamingMode: 'sequence',
      archivePatterns: ['_old'],
    }))

    expect(useAppStore.getState().projectSettings.processTable[0].revisionBorderColor)
      .toBe('#FCF9CF')
  })

  it('設定JSONへ登録名を含める', () => {
    useAppStore.getState().updateAutoMarkFolderNames(['BOOK', 'BG'])
    const exported = JSON.parse(useAppStore.getState().exportSettings()) as {
      autoMarkFolderNames?: string[]
    }
    expect(exported.autoMarkFolderNames).toEqual(['BOOK', 'BG'])
  })

  it('設定JSONへ命名設定と旧互換フィールドを含める', () => {
    useAppStore.getState().setSequenceDigitMode('fixed-4')
    useAppStore.getState().setCellPrefixSeparator('none')
    useAppStore.getState().setIncludeXdtsTrackPrefixInCellName(false)
    const exported = JSON.parse(useAppStore.getState().exportSettings()) as {
      sequenceDigitMode?: string
      cellPrefixSeparator?: string
      animationSequenceSeparator?: string
      includeXdtsTrackPrefixInCellName?: boolean
    }
    expect(exported.sequenceDigitMode).toBe('fixed-4')
    expect(exported.cellPrefixSeparator).toBe('none')
    expect(exported.animationSequenceSeparator).toBe('none')
    expect(exported.includeXdtsTrackPrefixInCellName).toBe(false)
  })
})
