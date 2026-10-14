import { act, cleanup, createEvent, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LayerTreePanel } from '../../components/LayerTreePanel'
import { buildLayerTree } from '../../engine/tree-builder'
import { useAppStore } from '../../store'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

beforeEach(() => {
  // This suite checks tree membership and selection, not browser scroll geometry.
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  cleanup()
  resetTestStore()
  vi.unstubAllGlobals()
})

function renderTree({ siblings = false, manualOpen = false, timeline = false } = {}) {
  const tree = buildLayerTree(makePsd({ children: [
    ...(siblings ? [makeFolder('marked-group', [makeFolder('_BG', [makeLayer({ name: 'background' })])])] : []),
    makeAnimationFolder('A', [
      ...(siblings ? [makeLayer({ name: '2' })] : []),
      makeFolder('1', [makeLayer({ name: 'body' }), makeFolder('作監', [makeLayer({ name: 'correction' })])]),
    ]),
  ] }))
  const anim = tree[0]
  anim.isAnimationFolder = true
  anim.animationFolder = timeline
    ? { detectedBy: 'xdts', trackName: 'A', trackNo: 0 }
    : { detectedBy: 'manual', trackName: 'A' }
  const cell = anim.children[0]
  const body = cell.children.find(layer => layer.originalName === 'body')!
  const process = cell.children.find(layer => layer.originalName === '作監')!
  const correction = process.children[0]
  const expanded = new Set<string>(manualOpen ? [anim.id, cell.id] : [])
  const collapsed = new Set<string>()
  resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100, expandedFolders: expanded, userCollapsedFolders: collapsed,
    timelineData: timeline ? {
      tracks: [{ name: 'A', trackNo: 0, cellNames: ['1'], frames: [{ frameIndex: 0, cellName: '1' }] }],
      duration: 8, fps: 24, timeTableName: 'test', version: 5, header: { cut: '1', scene: '1' },
    } : null,
  })
  render(<LayerTreePanel />)
  return { anim, cell, body, process, correction, expanded, collapsed, group: tree[1] }
}

function row(id: string) {
  return document.querySelector<HTMLElement>(`[data-layer-id="${id}"]`)
}

function wheel({ deltaY = 100, deltaX = 0, shiftKey = true } = {}) {
  const tree = screen.getByTestId('layer-tree')
  const event = createEvent.wheel(tree, { deltaY, deltaX, shiftKey, cancelable: true })
  fireEvent(tree, event)
  return event
}

describe('LayerTreePanel output navigation', () => {
  it('出力OFFと一部OFFを目玉とは独立して示し、OFFでも行を操作できる', () => {
    const { anim, body, process } = renderTree({ manualOpen: true })
    act(() => useAppStore.getState().setExcludeBody(true))
    expect(row(anim.id)!.querySelector('[data-output-state="partial"]')).toHaveTextContent('一部OFF')
    expect(row(body.id)!.querySelector('[data-output-state="off"]')).toHaveTextContent('出力OFF')
    expect(row(body.id)!.querySelector('button[aria-pressed]')).toHaveAttribute('aria-pressed', 'true')
    expect(row(process.id)!.querySelector('[data-output-state]')).toBeNull()
    act(() => useAppStore.getState().toggleProcessSuffixExclusion('_s'))
    expect(row(anim.id)!.querySelector('[data-output-state="off"]')).toHaveTextContent('出力OFF')
    fireEvent.click(row(process.id)!)
    expect(useAppStore.getState().selectedLayerId).toBe(process.id)
  })

  it('辞書で名前指定から外れたフォルダには禁止と区別した理由を示す', () => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('_old_01', [makeLayer()])] }), undefined, ['_old'])
    resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100 })
    render(<LayerTreePanel />)
    expect(row(tree[0].id)!.querySelector('[data-output-state="name-excluded"]')).toHaveTextContent('名前指定の対象外')
    expect(row(tree[0].id)!.querySelector('button[aria-pressed]')).toHaveAttribute('aria-pressed', 'true')
  })
  it('shares list, search and tree selection while preserving manual folder state', () => {
    const { cell, process, expanded, collapsed } = renderTree({ manualOpen: true })
    expect(screen.queryByRole('group', { name: 'レイヤーパネルの表示' })).not.toBeInTheDocument()
    const files = screen.getByRole('listbox', { name: '出力ファイル' })
    expect(within(screen.getByRole('listbox', { name: '出力ファイル' })).getAllByRole('option').map(option => option.textContent)).toEqual(['A_1.jpg', 'A_1_s.jpg'])
    fireEvent.click(screen.getByRole('option', { name: 'A_1_s.jpg' }))
    expect(useAppStore.getState().selectedOutputSourceId).toBe(process.id)
    fireEvent.wheel(files, { shiftKey: true, deltaY: -100 })
    expect(useAppStore.getState().selectedOutputSourceId).toBe(cell.id)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '_s' } })
    fireEvent.keyDown(files, { key: 'ArrowDown' })
    expect(within(screen.getByRole('listbox', { name: '出力ファイル' })).getByRole('option', { selected: true })).toHaveTextContent('A_1_s.jpg')
    expect(useAppStore.getState().selectedOutputSourceId).toBe(process.id)
    fireEvent.click(screen.getByRole('button', { name: '選択中の出力をツリーで表示' }))
    expect(screen.getByTestId('layer-tree')).toBeVisible()
    expect(row(process.id)).toBeInTheDocument()
    expect(useAppStore.getState().expandedFolders).toBe(expanded)
    expect(useAppStore.getState().userCollapsedFolders).toBe(collapsed)
  })

  it('drops hidden or excluded list rows without selecting a different output, and restores them on undo', () => {
    const { process } = renderTree()
    fireEvent.click(screen.getByRole('option', { name: 'A_1_s.jpg' }))
    act(() => useAppStore.getState().toggleLayerVisibility(process.id))
    expect(screen.queryByRole('option', { name: 'A_1_s.jpg' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('listbox', { name: '出力ファイル' })).queryByRole('option', { selected: true })).not.toBeInTheDocument()
    expect(useAppStore.getState().selectedOutputSourceId).toBe(process.id)
    act(() => useAppStore.getState().undo())
    expect(within(screen.getByRole('listbox', { name: '出力ファイル' })).getByRole('option', { selected: true })).toHaveTextContent('A_1_s.jpg')
    act(() => useAppStore.setState({ outputConfig: { ...useAppStore.getState().outputConfig, format: 'png', excludedProcessSuffixes: ['_s'] } }))
    expect(within(screen.getByRole('listbox', { name: '出力ファイル' })).getAllByRole('option').map(option => option.textContent)).toEqual(['A_1.png'])
    expect(within(screen.getByRole('listbox', { name: '出力ファイル' })).queryByRole('option', { selected: true })).not.toBeInTheDocument()
  })

  it('reveals the current output without seeking a held cell back to its first frame', () => {
    const { process } = renderTree({ timeline: true })
    wheel()
    wheel()
    act(() => useAppStore.getState().seekToFrame(3))
    const cells = useAppStore.getState().selectedCells
    fireEvent.click(screen.getByRole('button', { name: '選択中の出力をツリーで表示' }))
    expect(useAppStore.getState().currentFrame).toBe(3)
    expect(useAppStore.getState().selectedCells).toBe(cells)
    expect(useAppStore.getState().selectedOutputSourceId).toBe(process.id)
    expect(row(process.id)).toBeInTheDocument()
  })

  it('keeps the clicked body row visible after navigating to an unmarked process folder', () => {
    const { anim, cell, body, process, correction, expanded, collapsed } = renderTree()
    expect(process.autoMarked).toBe(false)
    expect(row(body.id)).not.toBeInTheDocument()

    expect(wheel().defaultPrevented).toBe(true)
    expect(useAppStore.getState().selectedOutputSourceId).toBe(cell.id)
    expect(row(anim.id)).toBeInTheDocument()
    // Reveal the other output rows inside this cell, but not process contents.
    expect(row(process.id)).toBeInTheDocument()
    expect(row(correction.id)).not.toBeInTheDocument()
    wheel()
    expect(useAppStore.getState().selectedOutputSourceId).toBe(process.id)
    expect(row(body.id)).toBeInTheDocument()

    fireEvent.click(row(body.id)!)
    expect(useAppStore.getState().selectedLayerId).toBe(body.id)
    expect(row(body.id)).toBeInTheDocument()
    expect(row(process.id)).toBeInTheDocument()
    expect(useAppStore.getState().expandedFolders).toBe(expanded)
    expect(useAppStore.getState().userCollapsedFolders).toBe(collapsed)
  })

  it('closes immediately on a manual collapse and reveals the output again on the next Shift wheel', () => {
    const { cell, body, process, expanded } = renderTree()
    wheel()
    wheel()
    expect(row(body.id)).toBeInTheDocument()

    fireEvent.click(row(cell.id)!.querySelector('button')!)
    const collapsed = useAppStore.getState().userCollapsedFolders
    expect(collapsed.has(cell.id)).toBe(true)
    expect(row(body.id)).not.toBeInTheDocument()
    expect(row(process.id)).not.toBeInTheDocument()

    wheel({ deltaY: -100 })
    expect(useAppStore.getState().selectedOutputSourceId).toBe(cell.id)
    expect(row(body.id)).toBeInTheDocument()
    expect(row(process.id)).toBeInTheDocument()
    wheel()
    expect(useAppStore.getState().selectedOutputSourceId).toBe(process.id)
    expect(row(cell.id)).toBeInTheDocument()
    expect(row(body.id)).toBeInTheDocument()
    expect(row(process.id)).toBeInTheDocument()
    expect(useAppStore.getState().expandedFolders).toEqual(expanded)
    expect(useAppStore.getState().transientExpandedFolders.has(cell.id)).toBe(true)
  })

  it('drops temporary paths when moving to another output while leaving manual expansion untouched', () => {
    const { anim, cell, body, process, group, expanded } = renderTree({ siblings: true })
    wheel()
    expect(row(body.id)).toBeInTheDocument()
    expect(useAppStore.getState().transientExpandedFolders.has(cell.id)).toBe(true)
    wheel()
    expect(useAppStore.getState().selectedOutputSourceId).toBe(process.id)
    wheel()
    // The next cel is a leaf; the previous cel's contents fold back up.
    expect(row(body.id)).not.toBeInTheDocument()
    expect(useAppStore.getState().transientExpandedFolders.has(cell.id)).toBe(false)
    wheel()
    expect(useAppStore.getState().selectedOutputSourceId).toBe(group.children[0].id)
    expect(row(cell.id)).not.toBeInTheDocument()
    expect(useAppStore.getState().transientExpandedFolders.has(anim.id)).toBe(false)
    expect(row(group.children[0].id)).toBeInTheDocument()
    // _BG is already an output leaf, so its internal artwork stays closed.
    expect(row(group.children[0].children[0].id)).not.toBeInTheDocument()
    expect(useAppStore.getState().expandedFolders).toBe(expanded)
  })

  it('keeps folders that were manually open visible after navigation leaves them', () => {
    const { cell, body, group, expanded } = renderTree({ siblings: true, manualOpen: true })
    expect(row(body.id)).toBeInTheDocument()
    for (let i = 0; i < 4; i++) wheel()
    expect(useAppStore.getState().selectedOutputSourceId).toBe(group.children[0].id)
    expect(row(cell.id)).toBeInTheDocument()
    expect(row(body.id)).toBeInTheDocument()
    expect(useAppStore.getState().expandedFolders).toBe(expanded)
  })

  it('does not reopen a manually closed cel or move its clicked row during a timeline hold', () => {
    const { cell, body } = renderTree({ timeline: true })
    wheel()
    fireEvent.click(row(body.id)!)
    expect(useAppStore.getState().selectedLayerId).toBe(body.id)
    fireEvent.click(row(cell.id)!.querySelector('button')!)
    expect(row(body.id)).not.toBeInTheDocument()
    const beforeSeek = useAppStore.getState()
    act(() => useAppStore.getState().seekToFrame(2))
    expect(row(body.id)).not.toBeInTheDocument()
    expect(useAppStore.getState().selectedLayerId).toBe(body.id)
    expect(useAppStore.getState().selectedOutputSourceId).toBe(cell.id)
    expect(useAppStore.getState().transientExpandedFolders).toBe(beforeSeek.transientExpandedFolders)
    expect(useAppStore.getState().userCollapsedFolders).toBe(beforeSeek.userCollapsedFolders)
  })

  it('does not select another output when its eye button receives mousedown and click', () => {
    const { cell, process } = renderTree()
    wheel()
    const before = useAppStore.getState()
    expect(before.selectedLayerId).toBeNull()
    const eye = row(process.id)!.querySelector('button[aria-label="プレビューから非表示にする"]')!
    fireEvent.mouseDown(eye, { button: 0 })
    fireEvent.mouseUp(eye, { button: 0 })
    fireEvent.click(eye, { detail: 1 })
    const after = useAppStore.getState()
    expect(after.visibilityOverrides.get(process.id)).toBe(true)
    expect(after.selectedLayerId).toBeNull()
    expect(after.selectedOutputSourceId).toBe(before.selectedOutputSourceId)
    expect(after.focusedAnimFolderId).toBe(before.focusedAnimFolderId)
    expect(after.selectedCells).toBe(before.selectedCells)
    // Keyboard activation has no mouse-down, but toggles once without selecting.
    fireEvent.keyDown(eye, { key: 'Enter' })
    fireEvent.click(eye, { detail: 0 })
    expect(useAppStore.getState().visibilityOverrides.get(process.id)).toBe(false)
    expect(useAppStore.getState().selectedOutputSourceId).toBe(cell.id)
  })

  it('leaves ordinary and zero-delta wheel events alone, and accepts Shift horizontal wheel events', () => {
    const { cell, process } = renderTree()
    expect(wheel({ shiftKey: false }).defaultPrevented).toBe(false)
    expect(wheel({ deltaY: 0 }).defaultPrevented).toBe(false)
    expect(useAppStore.getState().selectedLayerId).toBeNull()

    expect(wheel({ deltaY: 0, deltaX: 100 }).defaultPrevented).toBe(true)
    expect(useAppStore.getState().selectedOutputSourceId).toBe(cell.id)
    expect(wheel({ shiftKey: false }).defaultPrevented).toBe(false)
    expect(useAppStore.getState().selectedOutputSourceId).toBe(cell.id)
    wheel({ deltaY: 0, deltaX: 100 })
    expect(useAppStore.getState().selectedOutputSourceId).toBe(process.id)
  })
})
