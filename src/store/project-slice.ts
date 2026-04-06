import type { StateCreator } from 'zustand'
import type { ProjectSettings, ProcessFolderEntry, CellNamingMode } from '../types'
import { DEFAULT_PROJECT_SETTINGS } from '../types'
import type { AppStore } from './index'

export interface ProjectSlice {
  projectSettings: ProjectSettings
  updateProcessTable: (table: ProcessFolderEntry[]) => void
  setCellNamingMode: (mode: CellNamingMode) => void
  updateArchivePatterns: (patterns: string[]) => void
  importSettings: (json: string) => void
  exportSettings: () => string
}

export const createProjectSlice: StateCreator<AppStore, [], [], ProjectSlice> = (set, get) => ({
  projectSettings: DEFAULT_PROJECT_SETTINGS,

  updateProcessTable: (table) => {
    get().pushHistory()
    set({ projectSettings: { ...get().projectSettings, processTable: table } })
  },

  setCellNamingMode: (mode) => {
    get().pushHistory()
    set({ projectSettings: { ...get().projectSettings, cellNamingMode: mode } })
  },

  updateArchivePatterns: (patterns) => {
    get().pushHistory()
    set({ projectSettings: { ...get().projectSettings, archivePatterns: patterns } })
  },

  importSettings: (json) => {
    try {
      const parsed = JSON.parse(json) as ProjectSettings
      get().pushHistory()
      set({ projectSettings: { ...DEFAULT_PROJECT_SETTINGS, ...parsed } })
    } catch {
      console.error('Failed to import project settings')
    }
  },

  exportSettings: () => {
    return JSON.stringify(get().projectSettings, null, 2)
  },
})
