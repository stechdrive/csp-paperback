import { describe, expect, it } from 'vitest'
import { rowAtOffset, rowOffsets, visibleRowIndices } from '../../utils/virtual-rows'

describe('virtual output geometry', () => {
  it('includes partial rows at either edge, measured wrapped names and the draft heading', () => {
    const offsets = rowOffsets(6, new Map([[1, 120], [4, 85]]), 57)
    expect(offsets).toEqual([0, 57, 177, 234, 291, 376, 433])
    expect(visibleRowIndices(offsets, 56, 123, -1, 0)).toEqual([0, 1, 2])
    expect(visibleRowIndices(offsets, 300, 80, 0, 0)).toEqual([0, 4, 5])
  })

  it('keeps the active option in document order without mounting the intervening rows', () => {
    const offsets = rowOffsets(10_000, new Map(), 57)
    expect(visibleRowIndices(offsets, 57 * 5000, 114, 9999, 0)).toEqual([5000, 5001, 5002, 9999])
    expect(visibleRowIndices(offsets, 57 * 5000, 114, 1, 0)).toEqual([1, 5000, 5001, 5002])
    expect(visibleRowIndices(offsets, 57 * 5000, 114, 5001, 0)).toEqual([5000, 5001, 5002])
  })

  it('clamps the viewport when filtering shrinks the list, including zero results', () => {
    expect(visibleRowIndices([0], 100_000, 600, -1)).toEqual([])
    expect(visibleRowIndices([0, 57, 114], 100_000, 600, 0)).toEqual([0, 1])
    expect(rowAtOffset([0, 57, 114], 57)).toBe(1)
    expect(rowAtOffset([0, 57, 114], -100)).toBe(0)
  })
})
