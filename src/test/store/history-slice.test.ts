import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../store'
import { selectLayerById } from '../../store/selectors'
import { buildLayerTree } from '../../engine/tree-builder'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS } from '../../types'
import { DEFAULT_APP_THEME } from '../../theme'

function resetStore() {
  useAppStore.setState({
    rawPsd: null,
    psdFileName: null,
    psdSourceDirectory: null,
    layerTree: [],
    docWidth: 0,
    docHeight: 0,
    docDpiX: 0,
    docDpiY: 0,
    timelineData: null,
    xdtsFileName: null,
    xdtsSourceDirectory: null,
    unmatchedTracks: [],
    singleMarks: new Map(),
    virtualSets: [],
    manualAnimFolderIds: new Set(),
    visibilityOverrides: new Map(),
    expandedFolders: new Set(),
    userCollapsedFolders: new Set(),
    transientExpandedFolders: new Set(),
    selectedOutputSourceId: null,
    selectedLayerId: null,
    selectedCells: new Map(),
    focusedAnimFolderId: null,
    selectedVirtualSetId: null,
    selectedVsMemberSetId: null,
    selectedVsMemberId: null,
    currentFrame: 0,
    outputConfig: { ...DEFAULT_OUTPUT_CONFIG },
    savedOutputConfig: { ...DEFAULT_OUTPUT_CONFIG },
    projectSettings: DEFAULT_PROJECT_SETTINGS,
    activeTheme: DEFAULT_APP_THEME,
    _past: [],
    _future: [],
    canUndo: false,
    canRedo: false,
  })
}

beforeEach(() => resetStore())

describe('history-slice', () => {
  it('メンバー追加をUndoすると除去された子孫の選択を解除し、Redoで勝手に選択しない', () => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('group', [makeLayer()])] }))
    useAppStore.setState({ layerTree: tree })
    useAppStore.getState().addVirtualSet('layout')
    const id = useAppStore.getState().selectedVirtualSetId!
    useAppStore.getState().addVirtualSetMember(id, tree[0].id)
    useAppStore.getState().setSelectedVsMember(id, tree[0].children[0].id)
    useAppStore.getState().undo()
    expect(useAppStore.getState().selectedVsMemberId).toBeNull()
    expect(useAppStore.getState().selectedVsMemberSetId).toBeNull()
    useAppStore.getState().redo()
    expect(useAppStore.getState().selectedVsMemberId).toBeNull()
  })

  it('仮想セル作成をUndoしたときは存在しない巡回選択と一時展開を解除する', () => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('_old-output', [makeLayer()])] }))
    useAppStore.setState({ layerTree: tree, selectedLayerId: tree[0].id })
    useAppStore.getState().addVirtualSet('layout')
    useAppStore.setState({ transientExpandedFolders: new Set(['ancestor']) })
    useAppStore.getState().undo()
    expect(useAppStore.getState().selectedVirtualSetId).toBeNull()
    expect(useAppStore.getState().selectedLayerId).toBeNull()
    expect(useAppStore.getState().focusedAnimFolderId).toBeNull()
    expect(useAppStore.getState().selectedOutputSourceId).toBeNull()
    expect(useAppStore.getState().transientExpandedFolders.size).toBe(0)
  })

  it('Undo後も存在する仮想セル内の子孫選択は維持する', () => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('group', [makeLayer()])] }))
    useAppStore.setState({ layerTree: tree })
    useAppStore.getState().addVirtualSet('layout')
    const id = useAppStore.getState().selectedVirtualSetId!
    useAppStore.getState().addVirtualSetMember(id, tree[0].id)
    useAppStore.getState().setSelectedVsMember(id, tree[0].children[0].id)
    useAppStore.getState().updateVirtualSet(id, { name: 'renamed' })
    useAppStore.getState().undo()
    expect(useAppStore.getState().selectedVsMemberSetId).toBe(id)
    expect(useAppStore.getState().selectedVsMemberId).toBe(tree[0].children[0].id)
  })

  it('レイヤー本体の不透明度と合成モードをUndo/Redoできる', () => {
    const tree = buildLayerTree(makePsd({
      children: [makeLayer({ name: 'layer', opacity: 0.8, blendMode: 'normal' })],
    }))
    const id = tree[0].id
    useAppStore.setState({ layerTree: tree })

    useAppStore.getState().setLayerOpacity(id, 40)
    useAppStore.getState().setLayerBlendMode(id, 'multiply')

    let layer = selectLayerById(useAppStore.getState(), id)!
    expect(layer.opacity).toBe(40)
    expect(layer.blendMode).toBe('multiply')
    expect(layer.agPsdRef.opacity).toBeCloseTo(0.4)
    expect(layer.agPsdRef.blendMode).toBe('multiply')

    useAppStore.getState().undo()
    layer = selectLayerById(useAppStore.getState(), id)!
    expect(layer.opacity).toBe(40)
    expect(layer.blendMode).toBe('normal')
    expect(layer.agPsdRef.opacity).toBeCloseTo(0.4)
    expect(layer.agPsdRef.blendMode).toBe('normal')

    useAppStore.getState().undo()
    layer = selectLayerById(useAppStore.getState(), id)!
    expect(layer.opacity).toBe(80)
    expect(layer.blendMode).toBe('normal')
    expect(layer.agPsdRef.opacity).toBeCloseTo(0.8)

    useAppStore.getState().redo()
    layer = selectLayerById(useAppStore.getState(), id)!
    expect(layer.opacity).toBe(40)
    expect(layer.blendMode).toBe('normal')

    useAppStore.getState().redo()
    layer = selectLayerById(useAppStore.getState(), id)!
    expect(layer.opacity).toBe(40)
    expect(layer.blendMode).toBe('multiply')
  })

  it('手動マークをUndo/Redoできる', () => {
    useAppStore.getState().toggleSingleMark('layer-1')
    expect(useAppStore.getState().singleMarks.has('layer-1')).toBe(true)

    useAppStore.getState().undo()
    expect(useAppStore.getState().singleMarks.has('layer-1')).toBe(false)

    useAppStore.getState().redo()
    expect(useAppStore.getState().singleMarks.has('layer-1')).toBe(true)
  })

  it('手動アニメーションフォルダ指定をUndo/Redoできる', () => {
    const tree = buildLayerTree(makePsd({
      children: [makeFolder('BOOK', [makeLayer({ name: '1' })])],
    }))
    const id = tree[0].id
    useAppStore.setState({ layerTree: tree })

    useAppStore.getState().toggleManualAnimFolder(id)
    expect(useAppStore.getState().manualAnimFolderIds.has(id)).toBe(true)

    useAppStore.getState().undo()
    expect(useAppStore.getState().manualAnimFolderIds.has(id)).toBe(false)

    useAppStore.getState().redo()
    expect(useAppStore.getState().manualAnimFolderIds.has(id)).toBe(true)
  })

  it('仮想セルの連続リネームを1つの履歴としてUndo/Redoできる', () => {
    useAppStore.getState().addVirtualSet('仮想セル')
    const id = useAppStore.getState().virtualSets[0].id
    useAppStore.getState().clearHistory()

    useAppStore.getState().pushHistory()
    useAppStore.getState().updateVirtualSet(id, { name: '仮想セルA' }, { recordHistory: false })
    useAppStore.getState().updateVirtualSet(id, { name: '仮想セルAB' }, { recordHistory: false })

    expect(useAppStore.getState()._past).toHaveLength(1)
    expect(useAppStore.getState().virtualSets[0].name).toBe('仮想セルAB')

    useAppStore.getState().undo()
    expect(useAppStore.getState().virtualSets[0].name).toBe('仮想セル')

    useAppStore.getState().redo()
    expect(useAppStore.getState().virtualSets[0].name).toBe('仮想セルAB')
  })

  it('表示/非表示のなぞり操作を1つの履歴としてUndo/Redoできる', () => {
    const tree = buildLayerTree(makePsd({
      children: [
        makeLayer({ name: 'bottom' }),
        makeLayer({ name: 'top' }),
      ],
    }))
    const firstId = tree[0].id
    const secondId = tree[1].id
    useAppStore.setState({ layerTree: tree })

    useAppStore.getState().toggleLayerVisibility(firstId)
    useAppStore.getState().toggleLayerVisibility(secondId, { recordHistory: false })

    expect(useAppStore.getState()._past).toHaveLength(1)
    expect(useAppStore.getState().visibilityOverrides.size).toBe(2)

    useAppStore.getState().undo()
    expect(useAppStore.getState().visibilityOverrides.size).toBe(0)

    useAppStore.getState().redo()
    expect(useAppStore.getState().visibilityOverrides.get(firstId)).toBe(true)
    expect(useAppStore.getState().visibilityOverrides.get(secondId)).toBe(true)
  })
})
