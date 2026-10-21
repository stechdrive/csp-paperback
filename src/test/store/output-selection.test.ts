import { describe, expect, it } from 'vitest'
import { combineOutputSelection, outputSelectionPatch } from '../../store/output-selection'
import type { AppStore } from '../../store'

describe('shared output selection', () => {
  const selectedOutputIds = new Set(['a', 'e'])
  const state = { selectedOutputIds, outputSelectionAnchor: 'b' } as AppStore
  const orderedIds = ['a', 'b', 'c', 'd', 'e']
  it('replaces for Shift and adds a contiguous range for Ctrl+Shift', () => {
    expect(outputSelectionPatch(state, 'd', '', { range: true, orderedIds }).selectedOutputIds).toEqual(new Set(['b', 'c', 'd']))
    expect(outputSelectionPatch(state, 'd', '', { range: true, toggle: true, orderedIds }).selectedOutputIds).toEqual(new Set(orderedIds))
    expect(selectedOutputIds).toEqual(new Set(['a', 'e']))
  })
  it('adds, removes and toggles a rectangle against its initial snapshot', () => {
    expect(combineOutputSelection(selectedOutputIds, ['a', 'b'], 'add')).toEqual(new Set(['a', 'b', 'e']))
    expect(combineOutputSelection(selectedOutputIds, ['a', 'b'], 'remove')).toEqual(new Set(['e']))
    expect(combineOutputSelection(selectedOutputIds, ['a', 'b'], 'toggle')).toEqual(new Set(['b', 'e']))
    expect(combineOutputSelection(selectedOutputIds, ['a', 'b', 'c'], 'toggle')).toEqual(new Set(['b', 'c', 'e']))
    expect(combineOutputSelection(selectedOutputIds, ['a'], 'toggle')).toEqual(new Set(['e']))
    expect(selectedOutputIds).toEqual(new Set(['a', 'e']))
  })
})
