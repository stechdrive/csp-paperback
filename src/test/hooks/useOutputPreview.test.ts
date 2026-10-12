import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as cellExtractor from '../../engine/cell-extractor'
import { useOutputPreview } from '../../hooks/useOutputPreview'
import { useAppStore } from '../../store'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS, type XdtsData } from '../../types'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

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
  resetTestStore()
})

afterEach(() => {
  cleanup()
  resetTestStore()
})

describe('useOutputPreview', () => {
  function processTree() {
    const tree = buildLayerTree(makePsd({ children: [makeAnimationFolder('A', [
      makeFolder('2', [makeLayer({ name: 'body2' })]),
      makeFolder('1', [
        makeLayer({ name: 'body1' }),
        makeFolder('演出', [makeLayer({ name: 'correction2' })]),
        makeFolder('EN', [makeLayer({ name: 'correction1' })]),
      ]),
    ])] }))
    const anim = tree[0]
    markManualAnimFolder(anim)
    const cell = anim.children[0]
    const process = cell.children.find(layer => layer.originalName === 'EN')!
    useAppStore.setState({ layerTree: tree, docWidth: 100, docHeight: 100,
      projectSettings: { ...DEFAULT_PROJECT_SETTINGS, cellNamingMode: 'sequence', processTable: [{ suffix: '_e', folderNames: ['EN', '演出'] }] },
      selectedCells: new Map([[anim.id, 0]]), focusedAnimFolderId: anim.id,
      selectedLayerId: process.id, selectedOutputSourceId: process.id,
    })
    return { tree, anim, cell, process }
  }

  it('巡回対象の工程だけを表示し、除外された工程を本体へすり替えない', () => {
    processTree()
    const { result } = renderHook(() => useOutputPreview())
    expect(result.current.map(entry => entry.flatName)).toEqual(['A_2_e.jpg'])
    act(() => useAppStore.setState({ outputConfig: { ...DEFAULT_OUTPUT_CONFIG, excludedProcessSuffixes: ['_e'] } }))
    expect(result.current).toEqual([])
  })

  it('巡回のsourceが現在セルに存在しなければ別セルへフォールバックしない', () => {
    const { anim } = processTree()
    const { result } = renderHook(() => useOutputPreview())
    expect(result.current).toHaveLength(1)
    act(() => useAppStore.setState({ selectedCells: new Map([[anim.id, 1]]) }))
    expect(result.current).toEqual([])
  })

  it('巡回対象セルや祖先の目玉を閉じると出力も消え、再表示で戻る', () => {
    const { anim, cell } = processTree()
    const { result } = renderHook(() => useOutputPreview())
    act(() => useAppStore.getState().toggleLayerVisibility(cell.id))
    expect(result.current).toEqual([])
    act(() => useAppStore.getState().toggleLayerVisibility(cell.id))
    expect(result.current).toHaveLength(1)
    act(() => useAppStore.getState().toggleLayerVisibility(anim.id))
    expect(result.current).toEqual([])
  })

  it('通常の素材クリックは本体だけ、統合工程の後続フォルダ内クリックはその工程だけを表示する', () => {
    const { cell } = processTree()
    const body = cell.children.find(layer => layer.originalName === 'body1')!
    const laterProcess = cell.children.find(layer => layer.originalName === '演出')!
    useAppStore.setState({ focusedAnimFolderId: null, selectedOutputSourceId: null, selectedLayerId: body.id })
    const { result } = renderHook(() => useOutputPreview())
    expect(result.current.map(entry => entry.flatName)).toEqual(['A_2.jpg'])
    act(() => useAppStore.setState({ selectedLayerId: laterProcess.children[0].id }))
    expect(result.current.map(entry => entry.flatName)).toEqual(['A_2_e.jpg'])
  })

  it('通常セルクリックの複数出力も実際の工程除外設定に従う', () => {
    processTree()
    useAppStore.setState({ selectedOutputSourceId: null, outputConfig: { ...DEFAULT_OUTPUT_CONFIG, excludedProcessSuffixes: ['_e'] } })
    const { result } = renderHook(() => useOutputPreview())
    expect(result.current.map(entry => entry.flatName)).toEqual(['A_2.jpg'])
  })

  it('自動マーク出力の除外をプレビューへ反映し、手動マークでは除外を解除する', () => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('_BG', [makeLayer()])] }))
    useAppStore.setState({ layerTree: tree, docWidth: 100, docHeight: 100, selectedLayerId: tree[0].id,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, excludeAutoMarked: true } })
    const { result } = renderHook(() => useOutputPreview())
    expect(result.current).toEqual([])
    act(() => useAppStore.getState().toggleSingleMark(tree[0].id))
    expect(result.current).toHaveLength(1)
  })

  it('非表示中は出力画像を合成せず、表示時に最新セルを描画する', () => {
    const tree = buildLayerTree(makePsd({ children: [makeAnimationFolder('A', [makeLayer({ name: '1' }), makeLayer({ name: '2' })])] }))
    detectAnim(tree, 'A')
    useAppStore.setState({ layerTree: tree, docWidth: 100, docHeight: 100, focusedAnimFolderId: tree[0].id })
    const extract = vi.spyOn(cellExtractor, 'extractCells')
    try {
      const { result, rerender } = renderHook(({ enabled }) => useOutputPreview(enabled), { initialProps: { enabled: false } })
      expect(result.current).toEqual([])
      expect(extract).not.toHaveBeenCalled()
      act(() => useAppStore.setState({ selectedCells: new Map([[tree[0].id, 1]]) }))
      expect(extract).not.toHaveBeenCalled()
      rerender({ enabled: true })
      expect(result.current).toHaveLength(1)
      expect(result.current[0].flatName).toBe('A_1.jpg')
      expect(extract).toHaveBeenCalledTimes(1)
    } finally {
      extract.mockRestore()
    }
  })

  it('別トラックだけのセル変更では選択中の出力を再合成しない', () => {
    const tree = buildLayerTree(makePsd({ children: [makeAnimationFolder('A', [makeLayer({ name: '1' })])] }))
    detectAnim(tree, 'A')
    useAppStore.setState({ layerTree: tree, docWidth: 100, docHeight: 100, focusedAnimFolderId: tree[0].id })
    const extract = vi.spyOn(cellExtractor, 'extractCells')
    try {
      const { result } = renderHook(() => useOutputPreview())
      const entries = result.current
      act(() => useAppStore.setState({ selectedCells: new Map([['another-track', 3]]) }))
      expect(result.current).toBe(entries)
      expect(extract).toHaveBeenCalledTimes(1)
    } finally {
      extract.mockRestore()
    }
  })

  it('親工程名の末尾空白を無視してプレビューにも工程サフィックスを付ける', () => {
    const tree = buildLayerTree(makePsd({
      children: [makeFolder('作監 \u3000', [makeAnimationFolder('A', [makeLayer({ name: '1' })])])],
    }))
    detectAnim(tree, 'A')
    useAppStore.setState({
      layerTree: tree,
      docWidth: 100,
      docHeight: 100,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, format: 'png' },
      focusedAnimFolderId: tree[0].children[0].id,
    })

    const { result } = renderHook(() => useOutputPreview())

    expect(result.current).toHaveLength(1)
    expect(result.current[0].flatName).toBe('A_1_s.png')
    expect(result.current[0].path).toBe('A/A_1_s.png')
  })

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
    expect(result.current[0].flatName).toBe('A_1.png')
    expect(result.current[0].path).toBe('A/A_1.png')
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
    expect(result.current[0].flatName).toBe('A_1_ア.png')
    expect(result.current[0].path).toBe('A/A_1_ア.png')
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
        cellNamingMode: 'sheet-sequence',
        sequenceDigitMode: 'fixed-4',
        cellPrefixSeparator: 'none',
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
    expect(result.current[0].flatName).toBe('B1_e.jpg')
  })

  it('セル名モードのXDTSフォルダ名省略をプレビューへ反映する', () => {
    const animFolder = makeAnimationFolder('A', [makeLayer({ name: '1' })])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    useAppStore.setState({
      layerTree: tree,
      docWidth: 100,
      docHeight: 100,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG },
      projectSettings: {
        ...DEFAULT_PROJECT_SETTINGS,
        cellNamingMode: 'cellname',
        includeXdtsTrackPrefixInCellName: false,
      },
      focusedAnimFolderId: tree[0].id,
    })

    const { result } = renderHook(() => useOutputPreview())
    expect(result.current).toHaveLength(1)
    expect(result.current[0].flatName).toBe('1.jpg')
    expect(result.current[0].path).toBe('A/1.jpg')
  })

  it('セル名モードのフォルダ名との区切りをプレビューへ反映する', () => {
    const animFolder = makeAnimationFolder('A', [makeLayer({ name: '1' })])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    tree[0].isAnimationFolder = true
    tree[0].animationFolder = { detectedBy: 'manual', trackName: 'A' }

    useAppStore.setState({
      layerTree: tree,
      docWidth: 100,
      docHeight: 100,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG },
      projectSettings: {
        ...DEFAULT_PROJECT_SETTINGS,
        cellNamingMode: 'cellname',
        cellPrefixSeparator: 'none',
      },
      focusedAnimFolderId: tree[0].id,
    })

    const { result } = renderHook(() => useOutputPreview())
    expect(result.current[0].flatName).toBe('A1.jpg')
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
