import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { useOutputNavigation } from '../../hooks/useOutputNavigation'
import { useOutputPreview } from '../../hooks/useOutputPreview'
import { useAppStore } from '../../store'
import { type TimelineData, type VirtualSet } from '../../types'
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

import { selectOutputFiles } from '../../store/selectors'
import { virtualOutputId } from '../../utils/output-identity'

describe('output navigation selection', () => {
  it('keeps source selection, virtual-cell editor and timeline independent from output selection', () => {
    const { first, firstProcess, second, virtualSet } = navigationFixture()
    const state = useAppStore.getState()
    state.selectLayer(first.id)
    state.setSelectedVirtualSet(virtualSet.id)
    const { result } = renderHook(() => useOutputNavigation())
    const snapshots: ReturnType<typeof useAppStore.getState>[] = []
    const unsubscribe = useAppStore.subscribe(state => snapshots.push(state))
    act(() => result.current.navigateTo(result.current.entries.findIndex(entry => entry.id === firstProcess.id)))
    unsubscribe()
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toMatchObject({ selectedLayerId: first.id, selectedVirtualSetId: virtualSet.id, selectedOutputSourceId: firstProcess.id, currentFrame: 0 })
    const active = snapshots[0].activeOutputId
    act(() => state.selectLayer(second.id))
    expect(useAppStore.getState()).toMatchObject({ activeOutputId: active, currentFrame: 0, selectedLayerId: second.id })
  })

  it.each(['body', 'process'] as const)('timeline seeking changes the %s output and preserves the source editor selection', async kind => {
    const { anim, first, second, firstProcess, secondProcess } = navigationFixture()
    const initial = kind === 'body' ? first : firstProcess, next = kind === 'body' ? second : secondProcess
    useAppStore.getState().selectLayer(firstProcess.children[0].id)
    const { result } = renderHook(() => ({ nav: useOutputNavigation(), preview: useOutputPreview() }))
    act(() => result.current.nav.navigateTo(result.current.nav.entries.findIndex(entry => entry.id === initial.id)))
    act(() => useAppStore.getState().seekToFrame(4))
    expect(useAppStore.getState()).toMatchObject({ currentFrame: 4, selectedLayerId: firstProcess.children[0].id, selectedOutputSourceId: next.id })
    expect(useAppStore.getState().selectedCells.get(anim.id)).toBe(1)
    await waitFor(() => expect(result.current.preview.map(entry => entry.flatName)).toEqual([kind === 'body' ? 'A_2.jpg' : 'A_2_s.jpg']))
    const before = useAppStore.getState()
    act(() => useAppStore.getState().seekToFrame(5))
    expect(useAppStore.getState().selectedCells).toBe(before.selectedCells)
    expect(useAppStore.getState().activeOutputId).toBe(before.activeOutputId)
  })

  it('reads fresh output selection and visibility for a rapid wheel burst', () => {
    const tree = buildLayerTree(makePsd({ children: ['3', '2', '1'].map(name => makeFolder('_' + name, [makeLayer()])) }))
    resetTestStore({ layerTree: tree })
    const { result } = renderHook(() => useOutputNavigation())
    act(() => {
      result.current.navigate(1)
      useAppStore.getState().toggleLayerVisibility(tree[1].id)
      expect(result.current.navigate(1)?.id).toBe(tree[2].id)
      result.current.navigate(-1)
    })
    expect(useAppStore.getState().selectedOutputSourceId).toBe(tree[0].id)
    expect(useAppStore.getState().selectedLayerId).toBeNull()
    expect(result.current.entries.map(entry => entry.id)).toEqual([tree[0].id, tree[2].id])
  })

  it('does not switch to another output when hidden, and undo restores the selected output', async () => {
    const { firstProcess } = navigationFixture()
    const file = selectOutputFiles(useAppStore.getState()).find(file => file.sourceLayerId === firstProcess.id)!
    useAppStore.getState().selectOutputFile(file.outputId)
    const { result } = renderHook(() => ({ nav: useOutputNavigation(), preview: useOutputPreview() }))
    await waitFor(() => expect(result.current.preview).toHaveLength(1))
    act(() => useAppStore.getState().toggleLayerVisibility(firstProcess.id))
    expect(result.current.preview).toEqual([])
    expect(result.current.nav.currentIdx).toBe(-1)
    expect(useAppStore.getState().activeOutputId).toBe(file.outputId)
    act(() => useAppStore.getState().undo())
    await waitFor(() => expect(result.current.preview).toHaveLength(1))
    expect(result.current.preview[0].outputId).toBe(file.outputId)
  })

  it('range and modifier selection use output IDs and keep the active preview within the selection', () => {
    navigationFixture()
    const files = selectOutputFiles(useAppStore.getState()), ids = files.map(file => file.outputId)
    useAppStore.getState().selectOutputFile(ids[0])
    useAppStore.getState().selectOutputFile(ids[2], { range: true, orderedIds: ids })
    expect([...useAppStore.getState().selectedOutputIds]).toEqual(ids.slice(0, 3))
    useAppStore.getState().selectOutputFile(ids[1], { toggle: true })
    expect([...useAppStore.getState().selectedOutputIds]).toEqual([ids[0], ids[2]])
    expect(useAppStore.getState().activeOutputId).toBe(ids[2])
  })

  it('placing and unplacing a virtual cell retains its preview identity', () => {
    const { virtualSet } = navigationFixture()
    const id = virtualOutputId(virtualSet.id)
    useAppStore.getState().selectOutputFile(id)
    useAppStore.setState({ virtualSets: [{ ...virtualSet, insertionLayerId: null }] })
    expect(useAppStore.getState().activeOutputId).toBe(id)
    expect(selectOutputFiles(useAppStore.getState()).some(file => file.outputId === id)).toBe(false)
    useAppStore.getState().selectOutputFile(id)
    useAppStore.setState({ virtualSets: [virtualSet] })
    expect(useAppStore.getState().activeOutputId).toBe(id)
    expect(selectOutputFiles(useAppStore.getState()).some(file => file.outputId === id)).toBe(true)
  })

  it('retains manual expansion and preserves a held timeline cell when revealing its source', () => {
    const { firstProcess, first } = navigationFixture()
    const { result } = renderHook(() => useOutputNavigation())
    act(() => result.current.navigateTo(result.current.entries.findIndex(entry => entry.id === firstProcess.id)))
    act(() => useAppStore.getState().setFolderExpanded(first.id, false))
    const folders = useAppStore.getState().expandedFolders
    act(() => useAppStore.getState().seekToFrame(2))
    expect(useAppStore.getState().transientExpandedFolders.has(first.id)).toBe(false)
    act(() => result.current.revealCurrent())
    expect(useAppStore.getState().currentFrame).toBe(2)
    expect(useAppStore.getState().transientExpandedFolders.has(first.id)).toBe(true)
    expect(useAppStore.getState().expandedFolders).toBe(folders)
  })

  it('resetting a document clears output, batch and quick-look selection together', () => {
    const { first } = navigationFixture()
    const file = selectOutputFiles(useAppStore.getState())[0]
    useAppStore.getState().selectOutputFile(file.outputId)
    useAppStore.getState().openQuickLook(first.id)
    useAppStore.getState().resetProject()
    expect(useAppStore.getState()).toMatchObject({ activeOutputId: null, quickLookTarget: null })
    expect(useAppStore.getState().selectedOutputIds.size).toBe(0)
  })
})
