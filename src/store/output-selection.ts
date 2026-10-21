import type { AppStore } from './index'

export interface OutputSelectionOptions {
  preserveTimeline?: boolean
  reveal?: boolean
  toggle?: boolean
  range?: boolean
  orderedIds?: string[]
}

export function outputSelectionPatch(state: AppStore, id: string, label: string, options?: OutputSelectionOptions): Partial<AppStore> {
  let ids = new Set([id])
  if (options?.range && state.outputSelectionAnchor && options.orderedIds) {
    const a = options.orderedIds.indexOf(state.outputSelectionAnchor), b = options.orderedIds.indexOf(id)
    if (a >= 0 && b >= 0) ids = new Set([...(options.toggle ? state.selectedOutputIds : []), ...options.orderedIds.slice(Math.min(a, b), Math.max(a, b) + 1)])
  } else if (options?.toggle) {
    ids = new Set(state.selectedOutputIds)
    if (ids.has(id)) ids.delete(id)
    else ids.add(id)
  }
  return { activeOutputId: id, activeOutputLabel: label, selectedOutputIds: ids,
    outputSelectionAnchor: options?.range ? state.outputSelectionAnchor : id }
}

export function emptyOutputSelection() {
  return { activeOutputId: null, activeOutputLabel: '', selectedOutputIds: new Set<string>(),
    outputSelectionAnchor: null, outputViewMode: 'tiles' as const, outputSearch: '', quickLookTarget: null }
}

export type RangeSelectionMode = 'add' | 'remove' | 'toggle'
/** Always combine with the pointer-down snapshot, never the last pointer move. */
export function combineOutputSelection(initial: ReadonlySet<string>, affected: readonly string[], mode: RangeSelectionMode): Set<string> {
  const next = new Set(initial)
  for (const id of affected) {
    if (mode === 'remove' || (mode === 'toggle' && initial.has(id))) next.delete(id)
    else next.add(id)
  }
  return next
}
