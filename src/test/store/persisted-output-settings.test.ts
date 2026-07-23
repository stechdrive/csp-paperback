import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG } from '../../types'
import { resetTestStore } from '../helpers/store-reset'

const STORAGE_KEY = 'csp-paperback:settings'

beforeEach(resetTestStore)
afterEach(resetTestStore)

describe('persisted output settings', () => {
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
