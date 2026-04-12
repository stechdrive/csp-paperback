import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS } from '../../types'
import { DEFAULT_APP_THEME } from '../../theme'

// Zustandストアのテスト：各テスト前にストアをリセット
beforeEach(() => {
  useAppStore.setState({
    rawPsd: null,
    psdFileName: null,
    layerTree: [],
    docWidth: 0,
    docHeight: 0,
    xdtsData: null,
    xdtsFileName: null,
    singleMarks: new Map(),
    virtualSets: [],
    manualAnimFolderIds: new Set(),
    selectedLayerId: null,
    outputConfig: DEFAULT_OUTPUT_CONFIG,
    projectSettings: DEFAULT_PROJECT_SETTINGS,
    activeTheme: DEFAULT_APP_THEME,
  })
})

describe('psd-slice', () => {
  it('初期状態はnull/空', () => {
    const state = useAppStore.getState()
    expect(state.rawPsd).toBeNull()
    expect(state.psdFileName).toBeNull()
    expect(state.layerTree).toEqual([])
    expect(state.docWidth).toBe(0)
    expect(state.docHeight).toBe(0)
  })

  it('resetPsdで状態をクリアする', () => {
    useAppStore.setState({ psdFileName: 'test.psd', docWidth: 100 })
    useAppStore.getState().resetPsd()
    const state = useAppStore.getState()
    expect(state.psdFileName).toBeNull()
    expect(state.docWidth).toBe(0)
  })

  it('resetProjectでファイル依存状態をクリアし、共有設定は保持する', () => {
    const projectSettings = {
      ...DEFAULT_PROJECT_SETTINGS,
      archivePatterns: ['_old', '_pool', '_tmp'],
    }

    useAppStore.setState({
      psdFileName: 'test.psd',
      docWidth: 100,
      xdtsFileName: 'test.xdts',
      singleMarks: new Map([['layer-1', { layerId: 'layer-1', origin: 'manual' as const }]]),
      virtualSets: [{
        id: 'vs-1',
        name: '仮想セル',
        insertionLayerId: null,
        insertionPosition: 'above',
        members: [],
        expandToAnimationCells: false,
        visibilityOverrides: {},
      }],
      manualAnimFolderIds: new Set(['folder-1']),
      selectedLayerId: 'layer-1',
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, format: 'png', background: 'transparent' },
      projectSettings,
    })

    useAppStore.getState().resetProject()
    const state = useAppStore.getState()

    expect(state.psdFileName).toBeNull()
    expect(state.xdtsFileName).toBeNull()
    expect(state.singleMarks.size).toBe(0)
    expect(state.virtualSets).toEqual([])
    expect(state.manualAnimFolderIds.size).toBe(0)
    expect(state.selectedLayerId).toBeNull()
    expect(state.outputConfig).toEqual(DEFAULT_OUTPUT_CONFIG)
    expect(state.projectSettings).toEqual(projectSettings)
  })
})
