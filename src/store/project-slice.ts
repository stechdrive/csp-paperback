import type { StateCreator } from 'zustand'
import type { ProjectSettings, ProcessFolderEntry, AnimationFolderMode } from '../types'
import { DEFAULT_PROJECT_SETTINGS } from '../types'
import type { AppStore } from './index'

export interface ProjectSlice {
  projectSettings: ProjectSettings
  updateProcessTable: (table: ProcessFolderEntry[]) => void
  setSequenceDigits: (digits: number) => void
  setDefaultMode: (mode: AnimationFolderMode) => void
  importSettings: (json: string) => void
  exportSettings: () => string
}

export const createProjectSlice: StateCreator<AppStore, [], [], ProjectSlice> = (set, get) => ({
  projectSettings: DEFAULT_PROJECT_SETTINGS,

  updateProcessTable: (table) => {
    set({ projectSettings: { ...get().projectSettings, processTable: table } })
  },

  setSequenceDigits: (digits) => {
    set({ projectSettings: { ...get().projectSettings, sequenceDigits: digits } })
  },

  setDefaultMode: (mode) => {
    set({ projectSettings: { ...get().projectSettings, defaultMode: mode } })
  },

  importSettings: (json) => {
    try {
      const parsed = JSON.parse(json) as ProjectSettings
      set({ projectSettings: { ...DEFAULT_PROJECT_SETTINGS, ...parsed } })
    } catch {
      console.error('Failed to import project settings')
    }
  },

  exportSettings: () => {
    return JSON.stringify(get().projectSettings, null, 2)
  },
})
