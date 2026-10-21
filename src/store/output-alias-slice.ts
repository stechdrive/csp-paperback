import type { StateCreator } from 'zustand'
import type { AppStore } from './index'
import { selectOutputAliasTargets } from './selectors'
import { sanitizePathSegment } from '../utils/path-sanitize'

export interface OutputAliasSlice {
  /** Source IDs survive role/visibility changes; a new document clears these aliases. */
  outputAliases: Map<string, string>
  setOutputAlias: (layerId: string, name: string) => void
  resetOutputAlias: (layerId: string) => void
}

export const createOutputAliasSlice: StateCreator<AppStore, [], [], OutputAliasSlice> = (set, get) => ({
  outputAliases: new Map(),
  setOutputAlias: (layerId, name) => {
    const state = get()
    if (!name.trim() || !selectOutputAliasTargets(state).has(layerId)) return
    // Treat the entire draft as one name, before any output path is constructed.
    const value = sanitizePathSegment(name)
    if (state.outputAliases.get(layerId) === value) return
    state.pushHistory()
    set({ outputAliases: new Map(state.outputAliases).set(layerId, value) })
  },
  resetOutputAlias: layerId => {
    const state = get()
    if (!state.outputAliases.has(layerId)) return
    state.pushHistory()
    const outputAliases = new Map(state.outputAliases)
    outputAliases.delete(layerId)
    set({ outputAliases })
  },
})
