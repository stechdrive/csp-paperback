/** Prefix offsets allow viewport lookup without walking every output on scroll. */
export function rowOffsets(count: number, sizes: ReadonlyMap<number, number>, estimate: number): number[] {
  const offsets = [0]
  for (let i = 0; i < count; i++) offsets.push(offsets[i] + (sizes.get(i) ?? estimate))
  return offsets
}

export function rowAtOffset(offsets: readonly number[], offset: number): number {
  let low = 0, high = offsets.length - 1
  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2)
    if (offsets[middle] <= offset) low = middle
    else high = middle - 1
  }
  return Math.min(low, offsets.length - 2)
}

export function visibleRowIndices(offsets: readonly number[], top: number, height: number, activeIndex: number, overscan = 240): number[] {
  if (offsets.length < 2) return []
  const first = rowAtOffset(offsets, Math.max(0, top - overscan))
  const last = rowAtOffset(offsets, top + height + overscan)
  const indices = Array.from({ length: last - first + 1 }, (_, i) => first + i)
  // Keep one real option for aria-activedescendant and the connection endpoint,
  // including when the user scrolls away from the selection.
  if (activeIndex >= 0 && activeIndex < offsets.length - 1) {
    if (activeIndex < first) indices.unshift(activeIndex)
    else if (activeIndex > last) indices.push(activeIndex)
  }
  return indices
}
