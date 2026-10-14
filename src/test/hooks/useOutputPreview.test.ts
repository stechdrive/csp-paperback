import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOutputPreview } from '../../hooks/useOutputPreview'
import { useAppStore } from '../../store'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS, type XdtsData } from '../../types'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'
import { selectOutputFiles, selectDraftOutputs } from '../../store/selectors'

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

function selectFixtureOutput() {
  const state = useAppStore.getState()
  const files = selectOutputFiles(state)
  const selected = files.find(file => file.sourceLayerId === (state.selectedVirtualSetId ?? state.selectedOutputSourceId ?? state.selectedLayerId))
    ?? files.find(file => file.animFolderId === state.focusedAnimFolderId && (!state.selectedCells.has(state.focusedAnimFolderId!) || file.sourceCellId === state.layerTree.flatMap(layer => [layer, ...layer.children]).find(layer => layer.id === state.focusedAnimFolderId)?.children[state.selectedCells.get(state.focusedAnimFolderId!)!]?.id))
    ?? files[0]
  if (selected) state.selectOutputFile(selected.outputId)
}
async function ready(result: { current: unknown[] }, count = 1) { await waitFor(() => expect(result.current).toHaveLength(count)) }

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
    selectFixtureOutput()
    return { tree, anim, cell, process }
  }


  it('keeps output identity when disabled and restores the same output', async () => {
    processTree()
    const { result } = renderHook(() => useOutputPreview())
    await ready(result)
    expect(result.current.map(entry => entry.flatName)).toEqual(['A_2_e.jpg'])
    const id = useAppStore.getState().activeOutputId
    act(() => useAppStore.setState({ outputConfig: { ...DEFAULT_OUTPUT_CONFIG, excludedProcessSuffixes: ['_e'] } }))
    expect(result.current).toEqual([])
    expect(useAppStore.getState().activeOutputId).toBe(id)
    act(() => useAppStore.setState({ outputConfig: DEFAULT_OUTPUT_CONFIG }))
    await ready(result)
    expect(result.current[0].outputId).toBe(id)
  })

  it('renders only the selected output and reuses it across editor selection and unrelated frames', async () => {
    const { process, cell } = processTree()
    const plans = selectOutputFiles(useAppStore.getState())
    const spies = plans.map(plan => vi.spyOn(plan, 'renderCanvas'))
    const { result } = renderHook(() => useOutputPreview())
    await ready(result)
    const image = result.current[0].canvas, frame = useAppStore.getState().currentFrame
    act(() => { useAppStore.getState().selectLayer(cell.id); useAppStore.setState({ selectedCells: new Map([['other', 3]]) }) })
    expect(result.current[0].canvas).toBe(image)
    expect(useAppStore.getState().currentFrame).toBe(frame)
    spies.forEach((spy, i) => expect(spy).toHaveBeenCalledTimes(plans[i].sourceLayerId === process.id ? 1 : 0))
    spies.forEach(spy => spy.mockRestore())
  })

  it('keeps the merged process identity when the first alias becomes hidden', async () => {
    const { process } = processTree()
    const { result } = renderHook(() => useOutputPreview())
    await ready(result)
    const id = result.current[0].outputId, image = result.current[0].canvas
    act(() => useAppStore.getState().toggleLayerVisibility(process.id))
    await ready(result)
    expect(result.current[0].outputId).toBe(id)
    expect(result.current[0].canvas).not.toBe(image)
    expect(result.current[0].sources!.all.has(process.id)).toBe(false)
  })

  it('hiding a cel or its ancestor clears the preview without switching outputs', async () => {
    const { cell, anim } = processTree()
    const { result } = renderHook(() => useOutputPreview())
    await ready(result)
    act(() => useAppStore.getState().toggleLayerVisibility(cell.id))
    expect(result.current).toEqual([])
    act(() => useAppStore.getState().toggleLayerVisibility(cell.id))
    await ready(result)
    act(() => useAppStore.getState().toggleLayerVisibility(anim.id))
    expect(result.current).toEqual([])
  })

  it('compares explicit output selections and filters disabled images', async () => {
    processTree()
    const files = selectOutputFiles(useAppStore.getState()).slice(0, 2)
    useAppStore.setState({ selectedOutputIds: new Set(files.map(file => file.outputId)), compareOutputs: true })
    const { result } = renderHook(() => useOutputPreview())
    await ready(result, 2)
    act(() => useAppStore.setState({ outputConfig: { ...DEFAULT_OUTPUT_CONFIG, excludedProcessSuffixes: ['_e'] } }))
    await ready(result)
    expect(result.current[0].flatName).toBe('A_2.jpg')
  })

  it('uses collision-resolved names for virtual cells and does not couple editor selection', async () => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('_A?1', [makeLayer()])] }))
    useAppStore.setState({ layerTree: tree, docWidth: 100, docHeight: 100, virtualSets: [{ id: 'vs', name: '_A?1',
      insertionLayerId: tree[0].id, insertionPosition: 'above', members: [{ layerId: tree[0].id, opacity: null, blendMode: null }],
      expandToAnimationCells: false, visibilityOverrides: {} }] })
    useAppStore.getState().selectOutputFile(selectOutputFiles(useAppStore.getState())[1].outputId)
    const { result } = renderHook(() => useOutputPreview())
    await ready(result)
    expect(result.current[0].flatName).toBe('_A_1_2.jpg')
    act(() => useAppStore.getState().selectLayer(tree[0].id))
    expect(result.current[0].flatName).toBe('_A_1_2.jpg')
    act(() => useAppStore.setState({ outputConfig: { ...DEFAULT_OUTPUT_CONFIG, format: 'png', excludeAutoMarked: true } }))
    await ready(result)
    expect(result.current[0].flatName).toBe('_A_1.png')
  })

  it('previews unplaced virtual cells separately from the export manifest', async () => {
    const { cell } = processTree()
    useAppStore.setState({ virtualSets: [{ id: 'draft', name: 'draft', insertionLayerId: null, insertionPosition: 'above',
      members: [{ layerId: cell.id, opacity: null, blendMode: null }], expandToAnimationCells: false, visibilityOverrides: {} }] })
    const draft = selectDraftOutputs(useAppStore.getState())[0]
    useAppStore.getState().selectOutputFile(draft.outputId)
    const { result } = renderHook(() => useOutputPreview())
    await ready(result)
    expect(result.current[0].flatName).toBe('draft')
    expect(selectOutputFiles(useAppStore.getState()).some(file => file.outputId === draft.outputId)).toBe(false)
  })

  it('does no work while disabled and cancels the obsolete recipe after a rapid selection', async () => {
    processTree()
    const plans = selectOutputFiles(useAppStore.getState())
    const spies = plans.map(plan => vi.spyOn(plan, 'renderCanvas'))
    const { result, rerender } = renderHook(({ enabled }) => useOutputPreview(enabled), { initialProps: { enabled: false } })
    expect(result.current).toEqual([])
    act(() => useAppStore.getState().selectOutputFile(plans.at(-1)!.outputId))
    rerender({ enabled: true })
    await ready(result)
    expect(result.current[0].outputId).toBe(plans.at(-1)!.outputId)
    spies.forEach((spy, i) => expect(spy).toHaveBeenCalledTimes(i === plans.length - 1 ? 1 : 0))
    spies.forEach(spy => spy.mockRestore())
  })

  it('親工程名の末尾空白を無視してプレビューにも工程サフィックスを付ける', async () => {
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

    selectFixtureOutput()
    const { result } = renderHook(() => useOutputPreview())
    await ready(result)

    expect(result.current).toHaveLength(1)
    expect(result.current[0].flatName).toBe('A_1_s.png')
    expect(result.current[0].path).toBe('A/A_1_s.png')
  })

  it('PNG選択時はアニメセルのプレビュー名を.pngで返す', async () => {
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

    selectFixtureOutput()
    const { result } = renderHook(() => useOutputPreview())
    await ready(result)

    expect(result.current).toHaveLength(1)
    expect(result.current[0].flatName).toBe('A_1.png')
    expect(result.current[0].path).toBe('A/A_1.png')
  })

  it('連番セル名モードではプレビュー名にもセル名を付加する', async () => {
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

    selectFixtureOutput()
    const { result } = renderHook(() => useOutputPreview())
    await ready(result)

    expect(result.current).toHaveLength(1)
    expect(result.current[0].flatName).toBe('A_1_ア.png')
    expect(result.current[0].path).toBe('A/A_1_ア.png')
  })

  it('最大可視セル数に合わせた連番桁数をプレビュー名にも使う', async () => {
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

    selectFixtureOutput()
    const { result } = renderHook(() => useOutputPreview())
    await ready(result)

    expect(result.current).toHaveLength(1)
    expect(result.current[0].flatName).toBe('A_001_1.png')
    expect(result.current[0].path).toBe('A/A_001_1.png')
  })

  it('4桁固定と連番区切りなしをプレビュー名にも反映する', async () => {
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

    selectFixtureOutput()
    const { result } = renderHook(() => useOutputPreview())
    await ready(result)
    expect(result.current[0].flatName).toBe('A0001.png')
    expect(result.current[0].path).toBe('A/A0001.png')
  })

  it('セル名末尾と工程サフィックスが一致するプレビュー名を重複させない', async () => {
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

    selectFixtureOutput()
    const { result } = renderHook(() => useOutputPreview())
    await ready(result)
    expect(result.current).toHaveLength(1)
    expect(result.current[0].flatName).toBe('B1_e.jpg')
  })

  it('セル名モードのXDTSフォルダ名省略をプレビューへ反映する', async () => {
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

    selectFixtureOutput()
    const { result } = renderHook(() => useOutputPreview())
    await ready(result)
    expect(result.current).toHaveLength(1)
    expect(result.current[0].flatName).toBe('1.jpg')
    expect(result.current[0].path).toBe('A/1.jpg')
  })

  it('セル名モードのフォルダ名との区切りをプレビューへ反映する', async () => {
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

    selectFixtureOutput()
    const { result } = renderHook(() => useOutputPreview())
    await ready(result)
    expect(result.current[0].flatName).toBe('A1.jpg')
  })

  it('PNG選択時はマーク済みレイヤーのプレビュー名も.pngで返す', async () => {
    const markedFolder = makeFolder('_撮影指示', [makeLayer({ name: 'body' })])
    const tree = buildLayerTree(makePsd({ children: [markedFolder] }))

    useAppStore.setState({
      layerTree: tree,
      docWidth: 100,
      docHeight: 100,
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG, format: 'png', background: 'transparent' },
      selectedLayerId: tree[0].id,
    })

    selectFixtureOutput()
    const { result } = renderHook(() => useOutputPreview())
    await ready(result)

    expect(result.current).toHaveLength(1)
    expect(result.current[0].flatName).toBe('_撮影指示.png')
    expect(result.current[0].path).toBe('_撮影指示.png')
  })

  it('hidden なセルを指したプレビューは別セルへ丸めず空になる', async () => {
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

    useAppStore.getState().selectAnimCell(tree[0].id, hiddenAIndex)
    const { result } = renderHook(() => useOutputPreview())
    expect(result.current).toHaveLength(0)
  })
})
