import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePreview } from '../../hooks/usePreview'
import { useAppStore } from '../../store'
import * as flatten from '../../engine/flatten'
import { buildLayerTree } from '../../engine/tree-builder'
import { makeAnimationFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

beforeEach(() => {
  vi.useFakeTimers()
  resetTestStore()
  const tree = buildLayerTree(makePsd({ children: [makeAnimationFolder('A', [makeLayer({ name: '1' }), makeLayer({ name: '2' })])] }))
  tree[0].isAnimationFolder = true
  tree[0].animationFolder = { detectedBy: 'manual', trackName: 'A' }
  useAppStore.setState({ layerTree: tree, docWidth: 100, docHeight: 100 })
})

afterEach(() => {
  cleanup()
  resetTestStore()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('usePreview', () => {
  it('composites once for the small and large navigator and updates both trailing views', async () => {
    const render = vi.spyOn(flatten, 'flattenToCanvas')
    const first = { current: document.createElement('canvas') }
    const second = { current: document.createElement('canvas') }
    renderHook(() => usePreview(first))
    renderHook(() => usePreview(second))
    await act(async () => { await vi.runAllTimersAsync() })
    expect(render).toHaveBeenCalledTimes(1)
    const folderId = useAppStore.getState().layerTree[0].id
    act(() => useAppStore.setState({ selectedCells: new Map([[folderId, 1]]) }))
    expect(render).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(150) })
    expect(render).toHaveBeenCalledTimes(2)
    expect(first.current.getContext('2d')!.drawImage).toHaveBeenLastCalledWith(render.mock.results[1].value, 0, 0)
    expect(second.current.getContext('2d')!.drawImage).toHaveBeenLastCalledWith(render.mock.results[1].value, 0, 0)
  })

  it('skips disabled views and cancels pending work when they are hidden', async () => {
    const render = vi.spyOn(flatten, 'flattenToCanvas')
    const ref = { current: document.createElement('canvas') }
    const { rerender } = renderHook(({ enabled }) => usePreview(ref, enabled), { initialProps: { enabled: false } })
    expect(render).not.toHaveBeenCalled()
    rerender({ enabled: true })
    await act(async () => { await vi.runAllTimersAsync() })
    expect(render).toHaveBeenCalledTimes(1)
    act(() => useAppStore.setState({ selectedCells: new Map([['selection', 1]]) }))
    rerender({ enabled: false })
    act(() => vi.advanceTimersByTime(150))
    expect(render).toHaveBeenCalledTimes(1)
  })
})
