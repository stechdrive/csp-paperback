import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { OutputTargetControls } from '../../components/OutputTargetControls'
import { buildLayerTree } from '../../engine/tree-builder'
import { useAppStore } from '../../store'
import { selectOutputCandidates, selectOutputFiles, selectOutputNavigation } from '../../store/selectors'
import { buildOutputEntriesFromState, planExportEntriesFromState } from '../../utils/export-entries'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

afterEach(() => { cleanup(); resetTestStore() })

function expectOutputs(names: string[]) {
  const state = useAppStore.getState()
  const files = selectOutputFiles(state)
  expect(files.map(file => file.flatName)).toEqual(names)
  expect(selectOutputNavigation(state).entries.map(entry => entry.id)).toEqual(files.map(file => file.sourceLayerId))
  expect(buildOutputEntriesFromState(state).map(entry => entry.flatName)).toEqual(names)
  expect(planExportEntriesFromState(state).map(entry => entry.flatName)).toEqual(names)
}

describe('output controls after hiding output material', () => {
  it.each(['marked', 'native'] as const)('keeps the organizer suppressed when its only %s child is hidden', kind => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('_原図', [
      makeFolder(kind === 'marked' ? '_BG' : 'A', [makeLayer({ name: '1' })]),
    ])] }))
    const child = tree[0].children[0]
    if (kind === 'native') {
      child.isAnimationFolder = true
      child.animationFolder = { detectedBy: 'clip', trackName: 'A' }
    }
    resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100 })
    render(<OutputTargetControls />)
    const names = [kind === 'marked' ? '_BG.jpg' : 'A_1.jpg']
    const gate = screen.getByRole('button', { name: kind === 'marked' ? 'BG 個別書き出し' : '作画' })
    const candidates = selectOutputCandidates(useAppStore.getState()).map(entry => entry.id)
    expectOutputs(names)

    act(() => useAppStore.getState().toggleLayerVisibility(child.id))
    expectOutputs([])
    expect(screen.queryByRole('button', { name: '原図 個別書き出し' })).not.toBeInTheDocument()
    expect(selectOutputCandidates(useAppStore.getState()).map(entry => entry.id)).toEqual(candidates)
    expect(gate).toBeInTheDocument()

    fireEvent.click(gate)
    expectOutputs([])
    act(() => useAppStore.getState().toggleLayerVisibility(child.id))
    expectOutputs([])
    fireEvent.click(gate)
    expectOutputs(names)
  })

  it('keeps a hidden process-only cel out of the body outputs and retains its process gate', () => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('A', [makeFolder('1', [
      makeFolder('_e', [makeLayer()]),
    ])])] }))
    tree[0].isAnimationFolder = true
    tree[0].animationFolder = { detectedBy: 'clip', trackName: 'A' }
    const process = tree[0].children[0].children[0]
    resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100 })
    render(<OutputTargetControls />)
    const gate = screen.getByRole('button', { name: '演出' })
    expectOutputs(['A_1_e.jpg'])

    act(() => useAppStore.getState().toggleLayerVisibility(process.id))
    expectOutputs([])
    expect(screen.queryByRole('button', { name: '作画' })).not.toBeInTheDocument()
    expect(selectOutputCandidates(useAppStore.getState()).map(entry => entry.id)).toEqual([process.id])
    expect(gate).toBeInTheDocument()

    fireEvent.click(gate)
    expectOutputs([])
    act(() => useAppStore.getState().toggleLayerVisibility(process.id))
    expectOutputs([])
    fireEvent.click(gate)
    expectOutputs(['A_1_e.jpg'])
  })
})
