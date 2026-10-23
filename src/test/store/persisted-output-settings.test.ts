import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS } from '../../types'
import { resetTestStore } from '../helpers/store-reset'

const STORAGE_KEY = 'csp-paperback:settings'

beforeEach(resetTestStore)
afterEach(resetTestStore)

describe('persisted output settings', () => {
  it('recovers malformed persisted fields while preserving valid settings', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, state: {
      projectSettings: { autoMarkFolderNames: [42], processTable: [null], cellNamingMode: 'sequence', bodyGroupName: 42 },
      savedOutputConfig: { format: 'png', excludedProcessSuffixes: [42], jpgQuality: 'bad', individualOutputOverrides: { SL: 'false' } },
      mobileUiScale: 'bad',
    } }))
    await useAppStore.persist.rehydrate()
    const state = useAppStore.getState()
    expect(state.projectSettings).toMatchObject({ autoMarkFolderNames: DEFAULT_PROJECT_SETTINGS.autoMarkFolderNames,
      processTable: DEFAULT_PROJECT_SETTINGS.processTable, cellNamingMode: 'sequence', bodyGroupName: '作画' })
    expect(state.savedOutputConfig).toMatchObject({ format: 'png', excludedProcessSuffixes: [], jpgQuality: 0.92, individualOutputOverrides: {} })
    expect(Number.isFinite(state.mobileUiScale)).toBe(true)
  })

  it('does not write settings on selection changes, but persists changes and Undo immediately', () => {
    useAppStore.setState({ selectedLayerId: null })
    const write = vi.spyOn(Storage.prototype, 'setItem')
    try {
      for (let i = 0; i < 100; i++) useAppStore.setState({ selectedLayerId: String(i) })
      expect(write).not.toHaveBeenCalled()
      useAppStore.getState().setCellNamingMode('sequence')
      expect(write).toHaveBeenCalledTimes(1)
      useAppStore.getState().undo()
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.projectSettings.cellNamingMode).toBe('cellname')
    } finally { write.mockRestore() }
  })

  it('旧設定のグループ名を補完して書き戻し、設定済み名称・照合名・色・出力選択を保持する', async () => {
    const legacyTable = DEFAULT_PROJECT_SETTINGS.processTable.map(entry => ({
      suffix: entry.suffix, folderNames: [...entry.folderNames], revisionBorderColor: entry.revisionBorderColor,
    }))
    const custom = { displayName: '作品専用', suffix: '_extra', folderNames: ['追加修正'], revisionBorderColor: '#123456' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: {
      projectSettings: { processTable: [...legacyTable, custom] },
      savedOutputConfig: { ...DEFAULT_OUTPUT_CONFIG, excludedProcessSuffixes: ['_y'] },
    } }))

    await useAppStore.persist.rehydrate()

    const table = useAppStore.getState().projectSettings.processTable
    expect(useAppStore.getState().projectSettings.bodyGroupName).toBe('作画')
    expect(table.map(entry => entry.displayName)).toEqual(['演出', '監督', '作監', 'その他修正', '総作監', '作品専用'])
    expect(table.slice(0, 5).map(({ suffix, folderNames, revisionBorderColor }) => ({ suffix, folderNames, revisionBorderColor })))
      .toEqual(legacyTable)
    expect(table[5]).toEqual(custom)
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(persisted.version).toBe(2)
    expect(persisted.state.projectSettings.processTable).toEqual(table)
    expect(persisted.state.savedOutputConfig.excludedProcessSuffixes).toEqual(['_y'])
    await useAppStore.persist.rehydrate()
    expect(useAppStore.getState().projectSettings.processTable).toEqual(table)
  })

  it('本体と素材名の選択、および工程表示名・読み込み表示設定を保存して復元する', async () => {
    useAppStore.getState().setBodyGroupName('原画')
    useAppStore.getState().setExcludeBody(true)
    useAppStore.getState().setIndividualOutputEnabled('SL', false)
    useAppStore.getState().setShowIndividualFoldersOnLoad(false)
    useAppStore.getState().updateProcessTable([{ displayName: '演出チェック', suffix: '_e', folderNames: ['演出', '_e'] }])
    const saved = localStorage.getItem(STORAGE_KEY)!
    resetTestStore()
    localStorage.setItem(STORAGE_KEY, saved)
    await useAppStore.persist.rehydrate()
    useAppStore.getState().resetProject()
    expect(useAppStore.getState().outputConfig).toMatchObject({ excludeBody: true, individualOutputOverrides: { sl: false } })
    expect(useAppStore.getState().projectSettings).toMatchObject({ showIndividualFoldersOnLoad: false, bodyGroupName: '原画',
      processTable: [{ displayName: '演出チェック', suffix: '_e', folderNames: ['演出', '_e'] }] })
  })

  it('旧クイック書き出し設定を保存済み書き出し設定として引き継ぐ', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      state: {
        quickExportConfig: {
          ...DEFAULT_OUTPUT_CONFIG,
          format: 'png',
          background: 'transparent',
          structure: 'hierarchy',
        },
      },
    }))

    await useAppStore.persist.rehydrate()

    expect(useAppStore.getState().savedOutputConfig).toMatchObject({
      format: 'png',
      background: 'transparent',
      structure: 'hierarchy',
    })
  })

  it('現行の保存済み設定をlocalStorageへ保存し、再読込で復元する', async () => {
    useAppStore.getState().setFormat('png', 'saved')
    useAppStore.getState().setStructure('hierarchy', 'saved')
    useAppStore.getState().setRevisionBorderEnabled(false, 'saved')

    const serialized = localStorage.getItem(STORAGE_KEY)
    const persisted = JSON.parse(serialized ?? '{}') as {
      state?: { savedOutputConfig?: typeof DEFAULT_OUTPUT_CONFIG }
    }
    expect(persisted.state?.savedOutputConfig).toMatchObject({
      format: 'png',
      background: 'transparent',
      structure: 'hierarchy',
      revisionBorderEnabled: false,
    })

    useAppStore.setState({ savedOutputConfig: { ...DEFAULT_OUTPUT_CONFIG } })
    localStorage.setItem(STORAGE_KEY, serialized!)
    await useAppStore.persist.rehydrate()

    expect(useAppStore.getState().savedOutputConfig).toMatchObject({
      format: 'png',
      background: 'transparent',
      structure: 'hierarchy',
      revisionBorderEnabled: false,
    })
  })

  it('復元した保存済み設定を次のプロジェクトの現在設定へ適用する', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      state: {
        savedOutputConfig: {
          ...DEFAULT_OUTPUT_CONFIG,
          format: 'png',
          background: 'transparent',
          structure: 'hierarchy',
        },
      },
    }))

    await useAppStore.persist.rehydrate()
    useAppStore.setState({
      psdFileName: 'before-reset.psd',
      docWidth: 100,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG },
    })
    useAppStore.getState().resetProject()

    expect(useAppStore.getState().outputConfig).toEqual(useAppStore.getState().savedOutputConfig)
    expect(useAppStore.getState().outputConfig).toMatchObject({
      format: 'png',
      background: 'transparent',
      structure: 'hierarchy',
    })
  })
})
