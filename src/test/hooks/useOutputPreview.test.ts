import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useOutputPreview } from '../../hooks/useOutputPreview'
import { useAppStore } from '../../store'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS, type XdtsData } from '../../types'
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

function markManualAnimFolder(layer: ReturnType<typeof buildLayerTree>[number]): void {
  layer.isAnimationFolder = true
  layer.animationFolder = { detectedBy: 'manual', trackName: layer.originalName }
}

function makeNumberedCellFolders(count: number) {
  return Array.from({ length: count }, (_, index) =>
    makeFolder(String(index + 1), [makeLayer({ name: `content-${index + 1}` })])
  )
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
    expect(result.current[0].flatName).toBe('A_01.png')
    expect(result.current[0].path).toBe('A/A_01.png')
  })

  it('連番セル名モードではプレビュー名にもセル名を付加する', () => {
    const animFolder = makeAnimationFolder('A', [makeLayer({ name: 'ア' })])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    useAppStore.setState({
      layerTree: tree,
      docWidth: 100,
      docHeight: 100,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, format: 'png', background: 'transparent' },
      projectSettings: { ...useAppStore.getState().projectSettings, cellNamingMode: 'sequence-cellname' },
      focusedAnimFolderId: tree[0].id,
    })

    const { result } = renderHook(() => useOutputPreview())

    expect(result.current).toHaveLength(1)
    expect(result.current[0].flatName).toBe('A_01_ア.png')
    expect(result.current[0].path).toBe('A/A_01_ア.png')
  })

  it('最大可視セル数に合わせた連番桁数をプレビュー名にも使う', () => {
    const targetAnim = makeAnimationFolder('A', [makeFolder('1', [makeLayer()])])
    const longAnim = makeAnimationFolder('B', makeNumberedCellFolders(100))
    const tree = buildLayerTree(makePsd({ children: [targetAnim, longAnim] }))
    for (const layer of tree) markManualAnimFolder(layer)

    const target = tree.find(layer => layer.originalName === 'A')
    expect(target).toBeDefined()

    useAppStore.setState({
      layerTree: tree,
      docWidth: 100,
      docHeight: 100,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, format: 'png', background: 'transparent' },
      projectSettings: { ...DEFAULT_PROJECT_SETTINGS, cellNamingMode: 'sequence-cellname' },
      focusedAnimFolderId: target!.id,
    })

    const { result } = renderHook(() => useOutputPreview())

    expect(result.current).toHaveLength(1)
    expect(result.current[0].flatName).toBe('A_001_1.png')
    expect(result.current[0].path).toBe('A/A_001_1.png')
  })

  it('4桁固定と連番区切りなしをプレビュー名にも反映する', () => {
    const animFolder = makeAnimationFolder('A', [makeLayer({ name: '1' })])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    useAppStore.setState({
      layerTree: tree,
      docWidth: 100,
      docHeight: 100,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, format: 'png', background: 'transparent' },
      projectSettings: {
        ...DEFAULT_PROJECT_SETTINGS,
        sequenceDigitMode: 'fixed-4',
        animationSequenceSeparator: 'none',
      },
      focusedAnimFolderId: tree[0].id,
    })

    const { result } = renderHook(() => useOutputPreview())
    expect(result.current[0].flatName).toBe('A0001.png')
    expect(result.current[0].path).toBe('A/A0001.png')
  })

  it('セル名末尾と工程サフィックスが一致するプレビュー名を重複させない', () => {
    const processFolder = makeFolder('_e', [makeLayer({ name: '修正' })])
    const cellFolder = makeFolder('B1_e', [processFolder])
    const animFolder = makeAnimationFolder('B', [cellFolder])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    tree[0].isAnimationFolder = true
    tree[0].animationFolder = { detectedBy: 'manual', trackName: 'B' }

    useAppStore.setState({
      layerTree: tree,
      docWidth: 100,
      docHeight: 100,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG },
      projectSettings: {
        ...DEFAULT_PROJECT_SETTINGS,
        processTable: [{ suffix: '_e', folderNames: ['_e'] }],
        cellNamingMode: 'cellname',
      },
      focusedAnimFolderId: tree[0].id,
    })

    const { result } = renderHook(() => useOutputPreview())
    expect(result.current).toHaveLength(1)
    expect(result.current[0].flatName).toBe('B_B1_e.jpg')
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

  it('hidden なセルを指したプレビューは別セルへ丸めず空になる', () => {
    const hiddenA = makeFolder('A', [makeLayer({ name: 'hidden-content' })])
    hiddenA.hidden = true
    const visibleA = makeFolder('A', [makeLayer({ name: 'visible-content' })])
    const visibleB = makeFolder('B', [makeLayer({ name: 'visible-content' })])
    const animFolder = makeAnimationFolder('A', [hiddenA, visibleA, visibleB])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    tree[0].isAnimationFolder = true
    tree[0].animationFolder = { detectedBy: 'manual', trackName: 'A' }

    const hiddenAIndex = tree[0].children.findIndex(child => child.originalName === 'A' && child.hidden)

    useAppStore.setState({
      layerTree: tree,
      docWidth: 100,
      docHeight: 100,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, format: 'jpg', background: 'white' },
      projectSettings: { ...useAppStore.getState().projectSettings, cellNamingMode: 'cellname' },
      focusedAnimFolderId: tree[0].id,
      selectedCells: new Map([[tree[0].id, hiddenAIndex]]),
    })

    const { result } = renderHook(() => useOutputPreview())

    expect(result.current).toHaveLength(0)
  })
})
