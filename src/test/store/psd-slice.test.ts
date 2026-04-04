import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../store'

// Zustandストアのテスト：各テスト前にストアをリセット
beforeEach(() => {
  useAppStore.setState({
    rawPsd: null,
    psdFileName: null,
    layerTree: [],
    docWidth: 0,
    docHeight: 0,
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
})
