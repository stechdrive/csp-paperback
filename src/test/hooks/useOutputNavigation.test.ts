import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { useOutputNavigation } from '../../hooks/useOutputNavigation'
import { useOutputPreview } from '../../hooks/useOutputPreview'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG, type TimelineData, type VirtualSet } from '../../types'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

afterEach(() => { cleanup(); resetTestStore() })

function navigationFixture() {
  const tree = buildLayerTree(makePsd({ children: [
    makeFolder('_BG', [makeLayer({ name: 'background' })]),
    makeAnimationFolder('A', ['2', '1'].map(name => makeFolder(name, [
      makeLayer({ name: `body-${name}` }),
      makeFolder('作監', [makeLayer({ name: `correction-${name}` })]),
    ]))),
  ] }))
  const anim = tree[0]
  anim.isAnimationFolder = true
  anim.animationFolder = { detectedBy: 'xdts', trackName: 'A', trackNo: 0 }
  const [first, second] = anim.children
  const firstProcess = first.children.find(layer => layer.originalName === '作監')!
  const secondProcess = second.children.find(layer => layer.originalName === '作監')!
  const bg = tree[1]
  const virtualSet: VirtualSet = {
    id: 'virtual-layout', name: 'layout', insertionLayerId: bg.id, insertionPosition: 'above',
    members: [{ layerId: first.id, blendMode: null, opacity: null }],
    expandToAnimationCells: false, visibilityOverrides: {},
  }
  const timelineData: TimelineData = {
    tracks: [{ name: 'A', trackNo: 0, cellNames: ['1', '2'], frames: [
      { frameIndex: 0, cellName: '1' }, { frameIndex: 4, cellName: '2' },
    ] }],
    duration: 8, fps: 24, timeTableName: 'test', version: 5, header: { cut: '1', scene: '1' },
  }
  resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100, timelineData, virtualSets: [virtualSet] })
  return { tree, anim, first, second, firstProcess, secondProcess, bg, virtualSet }
}

describe('output navigation selection', () => {
  it.each(['process', 'process-content', 'body-content'] as const)('clicking hidden %s keeps its output owner and restores the same image when shown', kind => {
    const { first, firstProcess } = navigationFixture()
    const body = first.children.find(layer => layer.originalName.startsWith('body-'))!
    const hiddenLayer = kind === 'body-content' ? body : firstProcess
    const selected = kind === 'process-content' ? firstProcess.children[0] : hiddenLayer
    const source = kind === 'body-content' ? first : firstProcess
    const { result } = renderHook(() => useOutputPreview())
    act(() => {
      useAppStore.getState().toggleLayerVisibility(hiddenLayer.id)
      useAppStore.getState().selectLayer(selected.id)
    })
    expect(useAppStore.getState().selectedLayerId).toBe(selected.id)
    expect(useAppStore.getState().selectedOutputSourceId).toBe(source.id)
    expect(result.current).toHaveLength(0)
    act(() => useAppStore.getState().toggleLayerVisibility(hiddenLayer.id))
    expect(useAppStore.getState().selectedLayerId).toBe(selected.id)
    expect(result.current.map(entry => entry.flatName)).toEqual([kind === 'body-content' ? 'A_1.jpg' : 'A_1_s.jpg'])
  })

  it('keeps an untimed manual cel selected when another timeline track moves', () => {
    const { tree } = navigationFixture()
    const manual = buildLayerTree(makePsd({ children: [makeFolder('manual', [makeLayer({ name: '2' }), makeLayer({ name: '1' })])] }))[0]
    useAppStore.setState({ layerTree: [...tree, manual], manualAnimFolderIds: new Set([manual.id]) })
    const { result } = renderHook(() => ({ nav: useOutputNavigation(), preview: useOutputPreview() }))
    act(() => result.current.nav.navigateTo(result.current.nav.entries.findIndex(entry => entry.id === manual.children[1].id)))
    const preview = result.current.preview
    act(() => useAppStore.getState().seekToFrame(4))
    expect(useAppStore.getState().selectedCells.get(manual.id)).toBe(1)
    expect(useAppStore.getState().selectedLayerId).toBe(manual.children[1].id)
    expect(result.current.preview).toBe(preview)
  })

  it('shows only the body or process image at each stop, while ordinary cell clicks still show both', () => {
    const tree = buildLayerTree(makePsd({ children: [makeAnimationFolder('A', [
      makeLayer({ name: '1' }),
      makeFolder('2', [makeFolder('_s', [makeLayer()]), makeLayer({ name: 'body' })]),
    ])] }))
    const anim = tree[0]
    anim.isAnimationFolder = true
    anim.animationFolder = { detectedBy: 'manual', trackName: 'A' }
    const expanded = new Set<string>()
    const collapsed = new Set([anim.id])
    resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100, expandedFolders: expanded, userCollapsedFolders: collapsed })
    const { result } = renderHook(() => ({ nav: useOutputNavigation(), preview: useOutputPreview() }))
    expect(result.current.nav.entries).toHaveLength(3)
    act(() => result.current.nav.navigate(1))
    expect(result.current.preview.map(e => e.flatName)).toEqual(['A_2.jpg'])
    expect(useAppStore.getState().selectedCells.get(anim.id)).toBe(0)
    act(() => result.current.nav.navigate(1))
    expect(result.current.preview.map(e => e.flatName)).toEqual(['A_2_s.jpg'])
    act(() => result.current.nav.navigate(1))
    expect(result.current.preview.map(e => e.flatName)).toEqual(['A_1.jpg'])
    expect(useAppStore.getState().selectedCells.get(anim.id)).toBe(1)
    expect(useAppStore.getState().expandedFolders).toBe(expanded)
    expect(useAppStore.getState().userCollapsedFolders).toBe(collapsed)
    // Direct clicks retain the existing multi-image preview.
    act(() => useAppStore.getState().selectAnimCell(anim.id, 0))
    expect(result.current.preview.map(e => e.flatName)).toEqual(['A_2.jpg', 'A_2_s.jpg'])
    act(() => result.current.nav.navigateTo(0))
    expect(result.current.preview.map(e => e.flatName)).toEqual(['A_2.jpg'])
    act(() => useAppStore.setState({ outputConfig: { ...DEFAULT_OUTPUT_CONFIG, excludedProcessSuffixes: ['_s'] } }))
    expect(result.current.nav.entries).toHaveLength(2)
    act(() => result.current.nav.navigate(1))
    expect(result.current.preview.map(e => e.flatName)).toEqual(['A_1.jpg'])
  })

  it('reads the latest selection for consecutive wheel events before React rerenders', () => {
    const tree = buildLayerTree(makePsd({ children: ['3', '2', '1'].map(name => makeFolder(`_${name}`, [makeLayer()])) }))
    resetTestStore({ layerTree: tree })
    const { result } = renderHook(() => useOutputNavigation())
    act(() => { result.current.navigate(1); result.current.navigate(1); result.current.navigate(1) })
    expect(useAppStore.getState().selectedLayerId).toBe(tree[2].id)
    act(() => result.current.navigate(-1))
    expect(useAppStore.getState().selectedLayerId).toBe(tree[1].id)
  })

  it('rechecks output visibility between consecutive actions before React rerenders', () => {
    const tree = buildLayerTree(makePsd({ children: ['3', '2', '1'].map(name => makeFolder(`_${name}`, [makeLayer()])) }))
    resetTestStore({ layerTree: tree })
    const { result } = renderHook(() => useOutputNavigation())
    const beforeRender = result.current
    expect(beforeRender.entries.map(entry => entry.id)).toEqual(tree.map(layer => layer.id))
    act(() => {
      beforeRender.navigate(1)
      useAppStore.getState().toggleLayerVisibility(tree[1].id)
      // This callback and its exposed entries still belong to the previous render.
      expect(beforeRender.entries[1].id).toBe(tree[1].id)
      expect(beforeRender.navigate(1)?.id).toBe(tree[2].id)
      expect(useAppStore.getState().selectedOutputSourceId).toBe(tree[2].id)
    })
    expect(result.current.entries.map(entry => entry.id)).toEqual([tree[0].id, tree[2].id])
    expect(result.current.currentIdx).toBe(1)
  })

  it('publishes a single consistent selection when navigation changes the output and cel', () => {
    const { anim, first, second, secondProcess, virtualSet } = navigationFixture()
    useAppStore.setState({ selectedCells: new Map([[anim.id, 0]]), selectedLayerId: first.id,
      selectedVirtualSetId: virtualSet.id })
    const { result } = renderHook(() => useOutputNavigation())
    const snapshots: Array<{
      layer: string | null; source: string | null; virtualSet: string | null;
      focus: string | null; cell: number | undefined; frame: number; revealed: string[];
    }> = []
    const unsubscribe = useAppStore.subscribe(state => snapshots.push({
      layer: state.selectedLayerId, source: state.selectedOutputSourceId,
      virtualSet: state.selectedVirtualSetId, focus: state.focusedAnimFolderId,
      cell: state.selectedCells.get(anim.id), frame: state.currentFrame,
      revealed: [...state.transientExpandedFolders],
    }))
    try {
      act(() => result.current.navigateTo(result.current.entries.findIndex(entry => entry.id === secondProcess.id)))
    } finally {
      unsubscribe()
    }
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toMatchObject({ layer: secondProcess.id, source: secondProcess.id,
      virtualSet: null, focus: anim.id, cell: 1, frame: 4 })
    expect(snapshots[0].revealed).toEqual(expect.arrayContaining([anim.id, second.id]))
    expect(snapshots[0].revealed).not.toContain(first.id)
    expect(snapshots[0].revealed).not.toContain(secondProcess.id)
  })

  it('ordinary source selections clear virtual or animation focus and direct cel clicks show all cel outputs', () => {
    const { anim, second, firstProcess, bg, virtualSet } = navigationFixture()
    const { result } = renderHook(() => ({ nav: useOutputNavigation(), preview: useOutputPreview() }))
    act(() => result.current.nav.navigateTo(result.current.nav.entries.findIndex(entry => entry.id === firstProcess.id)))
    expect(useAppStore.getState().focusedAnimFolderId).toBe(anim.id)
    act(() => useAppStore.getState().setSelectedVirtualSet(virtualSet.id))
    expect(useAppStore.getState().selectedVirtualSetId).toBe(virtualSet.id)
    act(() => useAppStore.getState().selectLayer(second.id))
    const cellState = useAppStore.getState()
    expect(cellState.selectedLayerId).toBe(second.id)
    expect(cellState.selectedCells.get(anim.id)).toBe(1)
    expect(cellState.focusedAnimFolderId).toBe(anim.id)
    expect(cellState.selectedVirtualSetId).toBeNull()
    expect(cellState.selectedOutputSourceId).toBeNull()
    expect(result.current.preview.map(entry => entry.flatName)).toEqual(['A_2.jpg', 'A_2_s.jpg'])

    act(() => useAppStore.getState().selectLayer(bg.id))
    expect(useAppStore.getState().focusedAnimFolderId).toBeNull()
    expect(useAppStore.getState().selectedOutputSourceId).toBeNull()
    expect(result.current.preview.map(entry => entry.flatName)).toEqual(['_BG.jpg'])
    act(() => useAppStore.getState().setSelectedVirtualSet(virtualSet.id))
    act(() => useAppStore.getState().selectLayer(bg.id))
    expect(useAppStore.getState().selectedVirtualSetId).toBeNull()
    expect(result.current.preview.map(entry => entry.flatName)).toEqual(['_BG.jpg'])
  })

  it.each(['body', 'process'] as const)('timeline seeking keeps the %s output, tree selection, and preview on the same cel', (kind) => {
    const { anim, first, second, firstProcess, secondProcess } = navigationFixture()
    const initialSource = kind === 'body' ? first : firstProcess
    const nextSource = kind === 'body' ? second : secondProcess
    const { result } = renderHook(() => ({ nav: useOutputNavigation(), preview: useOutputPreview() }))
    act(() => result.current.nav.navigateTo(result.current.nav.entries.findIndex(entry => entry.id === initialSource.id)))
    expect(useAppStore.getState().currentFrame).toBe(0)
    act(() => useAppStore.getState().seekToFrame(4))
    const afterSeek = useAppStore.getState()
    expect(afterSeek.currentFrame).toBe(4)
    expect(afterSeek.selectedLayerId).toBe(nextSource.id)
    expect(afterSeek.selectedOutputSourceId).toBe(nextSource.id)
    expect(afterSeek.focusedAnimFolderId).toBe(anim.id)
    expect(afterSeek.selectedCells.get(anim.id)).toBe(1)
    expect(afterSeek.transientExpandedFolders.has(first.id)).toBe(false)
    expect(afterSeek.transientExpandedFolders.has(second.id)).toBe(true)
    expect(result.current.nav.entries[result.current.nav.currentIdx].id).toBe(nextSource.id)
    expect(result.current.preview.map(entry => entry.flatName)).toEqual([kind === 'body' ? 'A_2.jpg' : 'A_2_s.jpg'])
    act(() => useAppStore.getState().seekToFrame(5))
    expect(useAppStore.getState().selectedCells).toBe(afterSeek.selectedCells)
    expect(useAppStore.getState().selectedOutputSourceId).toBe(nextSource.id)
  })

  it('a held cel keeps the clicked internal row and manual collapse without replacing them with the output source', () => {
    const { anim, first, firstProcess } = navigationFixture()
    const content = firstProcess.children[0]
    const { result } = renderHook(() => ({ nav: useOutputNavigation(), preview: useOutputPreview() }))
    act(() => useAppStore.getState().selectLayer(content.id))
    expect(useAppStore.getState().selectedLayerId).toBe(content.id)
    expect(useAppStore.getState().selectedOutputSourceId).toBe(firstProcess.id)
    expect(useAppStore.getState().selectedCells.get(anim.id)).toBe(0)
    act(() => useAppStore.getState().setFolderExpanded(first.id, false))
    const beforeSeek = useAppStore.getState()
    expect(beforeSeek.transientExpandedFolders.has(first.id)).toBe(false)
    act(() => useAppStore.getState().seekToFrame(2))
    const afterSeek = useAppStore.getState()
    expect(afterSeek.currentFrame).toBe(2)
    expect(afterSeek.selectedLayerId).toBe(content.id)
    expect(afterSeek.selectedOutputSourceId).toBe(firstProcess.id)
    expect(afterSeek.selectedCells).toBe(beforeSeek.selectedCells)
    expect(afterSeek.expandedFolders).toBe(beforeSeek.expandedFolders)
    expect(afterSeek.userCollapsedFolders).toBe(beforeSeek.userCollapsedFolders)
    expect(afterSeek.transientExpandedFolders).toBe(beforeSeek.transientExpandedFolders)
    expect(result.current.nav.entries[result.current.nav.currentIdx].id).toBe(firstProcess.id)
    expect(result.current.preview.map(entry => entry.flatName)).toEqual(['A_1_s.jpg'])
  })
})
