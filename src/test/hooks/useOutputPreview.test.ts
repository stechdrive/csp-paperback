import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useOutputPreview } from '../../hooks/useOutputPreview'
import { useAppStore } from '../../store'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { DEFAULT_OUTPUT_CONFIG, type XdtsData } from '../../types'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'

function detectAnim(tree: ReturnType<typeof buildLayerTree>, trackName: string) {
  const xdts: XdtsData = {
    tracks: [{ name: trackName, trackNo: 0, cellNames: [], frames: [] }],
    version: 5,
    header: { cut: '1', scene: '1' },
    timeTableName: 'タイムライン1',
    duration: 72,
    fps: 24,
  }
  detectAnimationFoldersByXdts(tree, xdts)
}

beforeEach(() => {
  useAppStore.getState().resetProject()
})

afterEach(() => {
  cleanup()
  useAppStore.getState().resetProject()
})

describe('useOutputPreview', () => {
  it('PNG選択時はアニメセルのプレビュー名を.pngで返す', () => {
    const animFolder = makeAnimationFolder('A', [makeLayer({ name: '1' })])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    useAppStore.setState({
      layerTree: tree,
      docWidth: 100,
      docHeight: 100,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, format: 'png', background: 'transparent' },
      focusedAnimFolderId: tree[0].id,
    })

    const { result } = renderHook(() => useOutputPreview())

    expect(result.current).toHaveLength(1)
    expect(result.current[0].flatName).toBe('A_0001.png')
    expect(result.current[0].path).toBe('A/A_0001.png')
  })

  it('PNG選択時はマーク済みレイヤーのプレビュー名も.pngで返す', () => {
    const markedFolder = makeFolder('_撮影指示', [makeLayer({ name: 'body' })])
    const tree = buildLayerTree(makePsd({ children: [markedFolder] }))

    useAppStore.setState({
      layerTree: tree,
      docWidth: 100,
      docHeight: 100,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, format: 'png', background: 'transparent' },
      selectedLayerId: tree[0].id,
    })

    const { result } = renderHook(() => useOutputPreview())

    expect(result.current).toHaveLength(1)
    expect(result.current[0].flatName).toBe('_撮影指示.png')
    expect(result.current[0].path).toBe('_撮影指示.png')
  })
})
