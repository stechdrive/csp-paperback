import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../store'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS, type CspLayer, type XdtsData } from '../../types'
import { DEFAULT_APP_THEME } from '../../theme'
import { selectOutputNavigation } from '../../store/selectors'

beforeEach(() => {
  useAppStore.setState({
    selectedLayerId: null,
    activeOutputId: null,
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
    savedOutputConfig: DEFAULT_OUTPUT_CONFIG,
    timelineData: null,
    xdtsFileName: null,
    unmatchedTracks: [],
    selectedCells: new Map(),
    focusedAnimFolderId: null,
    selectedVirtualSetId: null,
    currentFrame: 0,
    activeTheme: DEFAULT_APP_THEME,
  })
})

function markManualAnimFolder(layer: CspLayer): void {
  layer.isAnimationFolder = true
  layer.animationFolder = { detectedBy: 'manual', trackName: layer.originalName }
}

describe('ui-slice XDTS timeline sync', () => {
  it.each(['row', 'output'] as const)('同名セルの%s明示選択を保持し、初出フレームで他トラックだけ同期する', mode => {
    const tree = buildLayerTree(makePsd({ children: [
      makeFolder('A', [makeLayer({ name: '1' }), makeLayer({ name: '1' })]),
      makeFolder('B', [makeLayer({ name: 'b1' }), makeLayer({ name: 'b2' })]),
    ] }))
    const timeline: XdtsData = {
      tracks: [
        { name: 'A', trackNo: 0, cellNames: ['1'], frames: [{ frameIndex: 5, cellName: '1' }, { frameIndex: 10, cellName: '1' }] },
        { name: 'B', trackNo: 1, cellNames: ['b1', 'b2'], frames: [{ frameIndex: 0, cellName: 'b1' }, { frameIndex: 3, cellName: 'b2' }] },
      ],
      duration: 12, fps: 24, version: 5, timeTableName: 'test', header: { cut: '1', scene: '1' },
    }
    detectAnimationFoldersByXdts(tree, timeline)
    const animA = tree.find(layer => layer.originalName === 'A')!
    const animB = tree.find(layer => layer.originalName === 'B')!
    useAppStore.setState({ layerTree: tree, timelineData: timeline, currentFrame: 11,
      selectedCells: new Map([[animA.id, 1], [animB.id, 1]]) })

    if (mode === 'row') useAppStore.getState().selectAnimCell(animA.id, 0)
    else {
      const entry = selectOutputNavigation(useAppStore.getState()).entries.find(candidate => candidate.id === animA.children[0].id)!
      useAppStore.getState().selectOutputEntry(entry)
    }

    const selected = useAppStore.getState()
    expect(selected.selectedLayerId).toBeNull()
    expect(selected.selectedCells.get(animA.id)).toBe(0)
    expect(selected.selectedCells.get(animB.id)).toBe(0)
    expect(selected.currentFrame).toBe(5)
    expect(selected.focusedAnimFolderId).toBe(animA.id)
    if (mode === 'output') expect(selected.selectedOutputSourceId).toBe(animA.children[0].id)

    // A timeline seek still uses CSP's bottom-first name resolution.
    useAppStore.getState().seekToFrame(6)
    expect(useAppStore.getState().selectedCells.get(animA.id)).toBe(1)
    expect(useAppStore.getState().selectedCells.get(animB.id)).toBe(0)
    expect(useAppStore.getState().selectedLayerId).toBeNull()
    expect(useAppStore.getState().currentFrame).toBe(6)
  })

  it('タイムライン未使用セルの明示選択ではフレーム位置と他トラックを変更しない', () => {
    const tree = buildLayerTree(makePsd({ children: [
      makeFolder('A', [makeLayer({ name: '1' }), makeLayer({ name: 'unused' })]),
      makeFolder('B', [makeLayer({ name: 'b1' }), makeLayer({ name: 'b2' })]),
    ] }))
    const timeline: XdtsData = {
      tracks: [
        { name: 'A', trackNo: 0, cellNames: ['1'], frames: [{ frameIndex: 0, cellName: '1' }] },
        { name: 'B', trackNo: 1, cellNames: ['b1', 'b2'], frames: [{ frameIndex: 0, cellName: 'b1' }, { frameIndex: 3, cellName: 'b2' }] },
      ],
      duration: 12, fps: 24, version: 5, timeTableName: 'test', header: { cut: '1', scene: '1' },
    }
    detectAnimationFoldersByXdts(tree, timeline)
    const animA = tree.find(layer => layer.originalName === 'A')!
    const animB = tree.find(layer => layer.originalName === 'B')!
    useAppStore.setState({ layerTree: tree, timelineData: timeline, currentFrame: 7,
      selectedCells: new Map([[animA.id, 1], [animB.id, 1]]) })
    useAppStore.getState().selectAnimCell(animA.id, 0)
    expect(useAppStore.getState().selectedCells.get(animA.id)).toBe(0)
    expect(useAppStore.getState().selectedCells.get(animB.id)).toBe(1)
    expect(useAppStore.getState().currentFrame).toBe(7)
  })

  it('ホールド区間はフレーム位置だけを更新し、選択セルの参照を保つ', () => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('A', [makeLayer({ name: '1' }), makeLayer({ name: '2' })])] }))
    const timeline: XdtsData = {
      tracks: [{ name: 'A', trackNo: 0, cellNames: ['1', '2'], frames: [{ frameIndex: 0, cellName: '1' }, { frameIndex: 4, cellName: '2' }] }],
      version: 5, header: { cut: '1', scene: '1' }, timeTableName: 'test', duration: 8, fps: 24,
    }
    detectAnimationFoldersByXdts(tree, timeline)
    useAppStore.setState({ layerTree: tree, timelineData: timeline })
    useAppStore.getState().seekToFrame(0)
    const first = useAppStore.getState().selectedCells
    useAppStore.getState().seekToFrame(3)
    expect(useAppStore.getState().currentFrame).toBe(3)
    expect(useAppStore.getState().selectedCells).toBe(first)
    useAppStore.getState().seekToFrame(4)
    const next = useAppStore.getState().selectedCells
    expect(next).not.toBe(first)
    useAppStore.getState().selectAnimCell(tree[0].id, next.get(tree[0].id)!)
    expect(useAppStore.getState().selectedCells).toBe(next)
  })

  it('同名トラックでも trackNo で各アニメフォルダのセルを同期する', () => {
    const bottomA = makeFolder('A', [makeLayer({ name: '1' }), makeLayer({ name: '2' })])
    const topA = makeFolder('A', [makeLayer({ name: '1' }), makeLayer({ name: '2' })])
    const psd = makePsd({ children: [bottomA, topA] })
    const tree = buildLayerTree(psd)
    const xdts: XdtsData = {
      tracks: [
        { name: 'A', trackNo: 0, cellNames: ['1'], frames: [{ frameIndex: 0, cellName: '1' }] },
        { name: 'A', trackNo: 1, cellNames: ['2'], frames: [{ frameIndex: 0, cellName: '2' }] },
      ],
      version: 5,
      header: { cut: '1', scene: '1' },
      timeTableName: 'タイムライン1',
      duration: 24,
      fps: 24,
    }
    detectAnimationFoldersByXdts(tree, xdts)

    const treeTopA = tree[0]
    const treeBottomA = tree[1]
    expect(treeBottomA.animationFolder?.trackNo).toBe(0)
    expect(treeTopA.animationFolder?.trackNo).toBe(1)

    useAppStore.setState({ layerTree: tree, timelineData: xdts })
    useAppStore.getState().seekToFrame(0)

    const selected = useAppStore.getState().selectedCells
    expect(selected.get(treeBottomA.id)).toBe(1) // bottom A の "1" は children 上 index 1
    expect(selected.get(treeTopA.id)).toBe(0) // top A の "2" は children 上 index 0
  })

  it('XDTSセル名が同一フォルダ内で重複する場合はボトム側のセルを選ぶ', () => {
    const bottomDuplicate = makeLayer({ name: '1' })
    const topDuplicate = makeLayer({ name: '1' })
    const animA = makeFolder('A', [bottomDuplicate, topDuplicate])
    const psd = makePsd({ children: [animA] })
    const tree = buildLayerTree(psd)
    const xdts: XdtsData = {
      tracks: [
        { name: 'A', trackNo: 0, cellNames: ['1'], frames: [{ frameIndex: 0, cellName: '1' }] },
      ],
      version: 5,
      header: { cut: '1', scene: '1' },
      timeTableName: 'タイムライン1',
      duration: 24,
      fps: 24,
    }
    detectAnimationFoldersByXdts(tree, xdts)

    const treeAnimA = tree[0]
    expect(treeAnimA.children).toHaveLength(2)
    expect(treeAnimA.children[0].originalName).toBe('1')
    expect(treeAnimA.children[1].originalName).toBe('1')

    useAppStore.setState({ layerTree: tree, timelineData: xdts })
    useAppStore.getState().seekToFrame(0)

    const selected = useAppStore.getState().selectedCells
    expect(selected.get(treeAnimA.id)).toBe(1)
  })

  it('hidden な同名セルがボトムなら、その children index を保持する', () => {
    const hiddenA = makeFolder('A', [makeLayer({ name: 'hidden-content' })])
    hiddenA.hidden = true
    const visibleA = makeFolder('A', [makeLayer({ name: 'visible-content' })])
    const visibleB = makeFolder('B', [makeLayer({ name: 'visible-content' })])
    const animA = makeFolder('A', [hiddenA, visibleA, visibleB])
    const psd = makePsd({ children: [animA] })
    const tree = buildLayerTree(psd)
    const xdts: XdtsData = {
      tracks: [
        { name: 'A', trackNo: 0, cellNames: ['A', 'B'], frames: [{ frameIndex: 0, cellName: 'A' }] },
      ],
      version: 5,
      header: { cut: '1', scene: '1' },
      timeTableName: 'タイムライン1',
      duration: 24,
      fps: 24,
    }
    detectAnimationFoldersByXdts(tree, xdts)

    useAppStore.setState({ layerTree: tree, timelineData: xdts })
    useAppStore.getState().seekToFrame(0)

    const hiddenAIndex = tree[0].children.findIndex(
      child => child.originalName === 'A' && child.hidden,
    )
    const selected = useAppStore.getState().selectedCells
    expect(selected.get(tree[0].id)).toBe(hiddenAIndex)
  })

  it('手動アニメフォルダのセル選択は同名XDTSトラックへ同期しない', () => {
    const bottomA = makeFolder('A', [makeLayer({ name: '1' }), makeLayer({ name: '2' })])
    const topA = makeFolder('A', [makeLayer({ name: '1' }), makeLayer({ name: '2' })])
    const psd = makePsd({ children: [bottomA, topA] })
    const tree = buildLayerTree(psd)
    const xdts: XdtsData = {
      tracks: [
        { name: 'A', trackNo: 0, cellNames: ['2'], frames: [{ frameIndex: 5, cellName: '2' }] },
      ],
      version: 5,
      header: { cut: '1', scene: '1' },
      timeTableName: 'タイムライン1',
      duration: 24,
      fps: 24,
    }
    detectAnimationFoldersByXdts(tree, xdts)

    const manualA = tree.find(layer => layer.originalName === 'A' && !layer.isAnimationFolder)
    const xdtsA = tree.find(layer => layer.originalName === 'A' && layer.isAnimationFolder)
    expect(manualA).toBeDefined()
    expect(xdtsA).toBeDefined()
    markManualAnimFolder(manualA!)

    useAppStore.setState({ layerTree: tree, timelineData: xdts, currentFrame: 0 })
    const cellIndex = manualA!.children.findIndex(cell => cell.originalName === '2')
    useAppStore.getState().selectAnimCell(manualA!.id, cellIndex)

    const state = useAppStore.getState()
    expect(state.selectedCells.get(manualA!.id)).toBe(cellIndex)
    expect(state.selectedCells.has(xdtsA!.id)).toBe(false)
    expect(state.currentFrame).toBe(0)
  })
})
