import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../store'
import { DEFAULT_PROJECT_SETTINGS } from '../../types'
import { processDisplayName } from '../../utils/process-folder'

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
  it.each([
    { autoMarkFolderNames: [42] }, { archivePatterns: [null] },
    { processTable: [{ suffix: '_x', folderNames: [42] }] },
    { sharedCutMode: 'false' }, { cellNamingMode: 'invalid' }, { autoMarkFolderNames: ['x'.repeat(4097)] },
    null, [],
  ])('rejects invalid settings atomically, preserving persisted settings and Undo (%j)', invalid => {
    const before = useAppStore.getState(), saved = localStorage.getItem('csp-paperback:settings')
    expect(() => before.importSettings(JSON.stringify(invalid))).toThrow()
    expect(useAppStore.getState().projectSettings).toBe(before.projectSettings)
    expect(useAppStore.getState()._past).toBe(before._past)
    expect(localStorage.getItem('csp-paperback:settings')).toBe(saved)
  })

  it('表示名と読み込み設定のない旧JSONを互換で読み、新設定を共有できる', () => {
    useAppStore.getState().importSettings(JSON.stringify({ processTable: [{ suffix: '_e', folderNames: ['_e', '演出修正'] }] }))
    expect(processDisplayName(useAppStore.getState().projectSettings.processTable[0])).toBe('演出')
    expect(useAppStore.getState().projectSettings.showIndividualFoldersOnLoad).toBe(true)
    useAppStore.getState().setShowIndividualFoldersOnLoad(false)
    useAppStore.getState().updateProcessTable([{ displayName: '演出', suffix: '_e', folderNames: ['_e', '演出修正'] }])
    const json = useAppStore.getState().exportSettings()
    useAppStore.getState().importSettings('{}')
    useAppStore.getState().importSettings(json)
    expect(processDisplayName(useAppStore.getState().projectSettings.processTable[0])).toBe('演出')
    expect(useAppStore.getState().projectSettings.showIndividualFoldersOnLoad).toBe(false)
  })

  it('旧独自工程の名称を補完し、照合名と出力サフィックスの変更から独立して保存する', () => {
    useAppStore.getState().importSettings(JSON.stringify({ processTable: [
      { suffix: '_fx', folderNames: ['_fx', 'エフェクト修正'], revisionBorderColor: '#123456' },
      { suffix: '_only', folderNames: ['_予備'] },
      { suffix: '_empty', folderNames: [] },
    ] }))
    const table = useAppStore.getState().projectSettings.processTable
    expect(table.map(entry => entry.displayName)).toEqual(['エフェクト修正', '予備', '修正工程 3'])
    useAppStore.getState().updateProcessTable(table.map((entry, index) => index === 0
      ? { ...entry, suffix: '_effect', folderNames: ['効果修正'] } : entry))
    const exported = JSON.parse(useAppStore.getState().exportSettings())
    useAppStore.getState().importSettings(JSON.stringify(exported))
    expect(useAppStore.getState().projectSettings.processTable[0]).toEqual({
      displayName: 'エフェクト修正', suffix: '_effect', folderNames: ['効果修正'], revisionBorderColor: '#123456',
    })
  })
  it('セル名・アニメーションフォルダ名付加・区切りありをデフォルトにする', () => {
    expect(useAppStore.getState().projectSettings.cellNamingMode).toBe('cellname')
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
