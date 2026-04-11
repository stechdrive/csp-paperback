import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS } from '../../types'

beforeEach(() => {
  useAppStore.setState({
    rawPsd: null,
    psdFileName: null,
    layerTree: [],
    docWidth: 0,
    docHeight: 0,
    singleMarks: new Map(),
    virtualSets: [],
    visibilityOverrides: new Map(),
    expandedFolders: new Set(),
    manualAnimFolderIds: new Set(),
    projectSettings: DEFAULT_PROJECT_SETTINGS,
    outputConfig: DEFAULT_OUTPUT_CONFIG,
    mobileUiScale: 1,
  })
})

describe('mobile ui scale', () => {
  it('setMobileUiScale clamps to 75% - 200%', () => {
    useAppStore.getState().setMobileUiScale(0.5)
    expect(useAppStore.getState().mobileUiScale).toBe(0.75)

    useAppStore.getState().setMobileUiScale(2.5)
    expect(useAppStore.getState().mobileUiScale).toBe(2)
  })

  it('resetProject keeps mobileUiScale', () => {
    useAppStore.getState().setMobileUiScale(1.35)
    useAppStore.getState().resetProject()
    expect(useAppStore.getState().mobileUiScale).toBe(1.35)
  })

  it('resetMobileUiScale returns to default', () => {
    useAppStore.getState().setMobileUiScale(1.6)
    useAppStore.getState().resetMobileUiScale()
    expect(useAppStore.getState().mobileUiScale).toBe(1)
  })
})
