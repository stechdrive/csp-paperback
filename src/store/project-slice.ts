import type { StateCreator } from 'zustand'
import type { ProjectSettings, ProcessFolderEntry, CellNamingMode } from '../types'
import { DEFAULT_PROJECT_SETTINGS } from '../types'
import { buildDefaultVisibilityOverrides } from '../utils/default-visibility'
import type { AppStore } from './index'

export interface ProjectSlice {
  projectSettings: ProjectSettings
  updateProcessTable: (table: ProcessFolderEntry[]) => void
  setCellNamingMode: (mode: CellNamingMode) => void
  setSharedCutMode: (enabled: boolean) => void
  updateAutoMarkFolderNames: (names: string[]) => void
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

  setSharedCutMode: (enabled) => {
    const { projectSettings, layerTree, xdtsData } = get()
    if (!!projectSettings.sharedCutMode === enabled) return

    get().pushHistory()
    const nextSettings = { ...projectSettings, sharedCutMode: enabled }
    const nextState: Partial<AppStore> = { projectSettings: nextSettings }

    if (layerTree.length > 0) {
      nextState.visibilityOverrides = buildDefaultVisibilityOverrides(layerTree, xdtsData, enabled)
    }

    set(nextState as AppStore)
  },

  updateAutoMarkFolderNames: (names) => {
    get().pushHistory()
    set({ projectSettings: { ...get().projectSettings, autoMarkFolderNames: names } })
  },

  updateArchivePatterns: (patterns) => {
    get().pushHistory()
    set({ projectSettings: { ...get().projectSettings, archivePatterns: patterns } })
  },

  importSettings: (json) => {
    try {
      const parsed = JSON.parse(json) as ProjectSettings
      get().pushHistory()
      set({
        projectSettings: {
          ...DEFAULT_PROJECT_SETTINGS,
          ...parsed,
          autoMarkFolderNames: Array.isArray(parsed.autoMarkFolderNames)
            ? parsed.autoMarkFolderNames
            : DEFAULT_PROJECT_SETTINGS.autoMarkFolderNames,
          archivePatterns: Array.isArray(parsed.archivePatterns)
            ? parsed.archivePatterns
            : DEFAULT_PROJECT_SETTINGS.archivePatterns,
        },
      })
    } catch {
      console.error('Failed to import project settings')
    }
  },

  exportSettings: () => {
    return JSON.stringify(get().projectSettings, null, 2)
  },
})
