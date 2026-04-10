import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../store'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS, type XdtsData } from '../../types'

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
  })
})

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
})
