import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { useOutputNavigation } from '../../hooks/useOutputNavigation'
import { useOutputPreview } from '../../hooks/useOutputPreview'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG } from '../../types'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

afterEach(() => { cleanup(); resetTestStore() })

describe('output navigation selection', () => {
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
})
