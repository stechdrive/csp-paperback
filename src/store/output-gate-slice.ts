import type { StateCreator } from 'zustand'
import type { AppStore } from './index'
import { selectOutputFiles } from './selectors'
import type { HistoryOptions } from './history-slice'

export interface OutputGateSlice {
  /** Document-local intent. Hidden outputs retain their entry until explicitly restored. */
  outputExclusions: Set<string>
  setOutputsEnabled: (outputIds: ReadonlySet<string>, enabled: boolean, options?: HistoryOptions) => void
  resetOutputExclusions: () => void
}

export const createOutputGateSlice: StateCreator<AppStore, [], [], OutputGateSlice> = (set, get) => ({
  outputExclusions: new Set(),
  setOutputsEnabled: (outputIds, enabled, options) => {
    const current = get().outputExclusions
    const keys = selectOutputFiles(get()).filter(file => outputIds.has(file.outputId)).map(file => file.gateId)
    if (!keys.some(key => current.has(key) === enabled)) return
    if (options?.recordHistory !== false) get().pushHistory()
    const outputExclusions = new Set(current)
    for (const key of keys) { if (enabled) outputExclusions.delete(key); else outputExclusions.add(key) }
    set({ outputExclusions })
  },
  resetOutputExclusions: () => {
    if (!get().outputExclusions.size) return
    get().pushHistory()
    set({ outputExclusions: new Set() })
  },
})

export function selectEnabledOutputCount(state: AppStore): number {
  return selectOutputFiles(state).filter(file => !state.outputExclusions.has(file.gateId)).length
}
