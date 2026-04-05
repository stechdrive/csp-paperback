import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG } from '../../types'

beforeEach(() => {
  useAppStore.setState({ outputConfig: { ...DEFAULT_OUTPUT_CONFIG } })
})

describe('output-slice', () => {
  it('初期状態はデフォルト設定', () => {
    const { outputConfig } = useAppStore.getState()
    expect(outputConfig.format).toBe('jpg')
    expect(outputConfig.background).toBe('white')
    expect(outputConfig.structure).toBe('flat')
  })

  it('setFormatでjpgに変更すると背景が強制的にwhiteになる', () => {
    useAppStore.setState({ outputConfig: { ...DEFAULT_OUTPUT_CONFIG, format: 'png', background: 'transparent' } })
    useAppStore.getState().setFormat('jpg')
    expect(useAppStore.getState().outputConfig.background).toBe('white')
  })

  it('setFormatでpngに変更すると背景がtransparentになる', () => {
    useAppStore.getState().setFormat('png')
    expect(useAppStore.getState().outputConfig.background).toBe('transparent')
  })

  it('pngのときはtransparent背景を選択できる', () => {
    useAppStore.getState().setFormat('png')
    useAppStore.getState().setBackground('transparent')
    expect(useAppStore.getState().outputConfig.background).toBe('transparent')
  })

  it('jpgのときはtransparent背景を選択できない', () => {
    useAppStore.getState().setBackground('transparent')
    expect(useAppStore.getState().outputConfig.background).toBe('white')
  })

  it('setJpgQualityで品質を0〜1の範囲にクランプする', () => {
    useAppStore.getState().setJpgQuality(1.5)
    expect(useAppStore.getState().outputConfig.jpgQuality).toBe(1)
    useAppStore.getState().setJpgQuality(-0.1)
    expect(useAppStore.getState().outputConfig.jpgQuality).toBe(0)
  })

  it('setStructureで構造モードを変更する', () => {
    useAppStore.getState().setStructure('flat')
    expect(useAppStore.getState().outputConfig.structure).toBe('flat')
  })

})
