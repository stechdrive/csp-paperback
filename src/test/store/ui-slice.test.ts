import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../store'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS, type CspLayer, type XdtsData } from '../../types'
import { DEFAULT_APP_THEME } from '../../theme'

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
    xdtsData: null,
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

    useAppStore.setState({ layerTree: tree, xdtsData: xdts })
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

    useAppStore.setState({ layerTree: tree, xdtsData: xdts })
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

    useAppStore.setState({ layerTree: tree, xdtsData: xdts })
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

    useAppStore.setState({ layerTree: tree, xdtsData: xdts, currentFrame: 0 })
    const cellIndex = manualA!.children.findIndex(cell => cell.originalName === '2')
    useAppStore.getState().selectAnimCell(manualA!.id, cellIndex)

    const state = useAppStore.getState()
    expect(state.selectedCells.get(manualA!.id)).toBe(cellIndex)
    expect(state.selectedCells.has(xdtsA!.id)).toBe(false)
    expect(state.currentFrame).toBe(0)
  })
})
