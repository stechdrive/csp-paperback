import { afterEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG } from '../../types'

const STORAGE_KEY = 'csp-paperback:settings'

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY)
})

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
})
