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
  it('撮影指示と原図をデフォルト登録する', () => {
    expect(useAppStore.getState().projectSettings.autoMarkFolderNames).toEqual(['撮影指示', '原図'])
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
  })

  it('設定JSONへ登録名を含める', () => {
    useAppStore.getState().updateAutoMarkFolderNames(['BOOK', 'BG'])
    const exported = JSON.parse(useAppStore.getState().exportSettings()) as {
      autoMarkFolderNames?: string[]
    }
    expect(exported.autoMarkFolderNames).toEqual(['BOOK', 'BG'])
  })
})
