import type { StateCreator } from 'zustand'
import type {
  AnimationSequenceSeparator,
  CellPrefixSeparator,
  CellNamingMode,
  ProcessFolderEntry,
  ProjectSettings,
  SequenceDigitMode,
} from '../types'
import {
  DEFAULT_PROJECT_SETTINGS,
  resolveCellPrefixSeparator,
  resolveIncludeXdtsTrackPrefixInCellName,
} from '../types'
import { buildDefaultVisibilityOverrides } from '../utils/default-visibility'
import { normalizeProcessTableColors } from '../utils/process-color'
import type { AppStore } from './index'

export interface ProjectSlice {
  projectSettings: ProjectSettings
  updateProcessTable: (table: ProcessFolderEntry[]) => void
  setCellNamingMode: (mode: CellNamingMode) => void
  setSequenceDigitMode: (mode: SequenceDigitMode) => void
  setCellPrefixSeparator: (separator: CellPrefixSeparator) => void
  /** @deprecated 旧UI・テスト互換用 */
  setAnimationSequenceSeparator: (separator: AnimationSequenceSeparator) => void
  setIncludeXdtsTrackPrefixInCellName: (enabled: boolean) => void
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
    set({
      projectSettings: {
        ...get().projectSettings,
        processTable: normalizeProcessTableColors(table),
      },
    })
  },

  setCellNamingMode: (mode) => {
    get().pushHistory()
    set({ projectSettings: { ...get().projectSettings, cellNamingMode: mode } })
  },

  setSequenceDigitMode: (sequenceDigitMode) => {
    get().pushHistory()
    set({ projectSettings: { ...get().projectSettings, sequenceDigitMode } })
  },

  setCellPrefixSeparator: (cellPrefixSeparator) => {
    get().pushHistory()
    set({
      projectSettings: {
        ...get().projectSettings,
        cellPrefixSeparator,
        animationSequenceSeparator: cellPrefixSeparator,
      },
    })
  },

  setAnimationSequenceSeparator: (animationSequenceSeparator) => {
    get().pushHistory()
    set({
      projectSettings: {
        ...get().projectSettings,
        cellPrefixSeparator: animationSequenceSeparator,
        animationSequenceSeparator,
      },
    })
  },

  setIncludeXdtsTrackPrefixInCellName: (includeXdtsTrackPrefixInCellName) => {
    get().pushHistory()
    set({
      projectSettings: {
        ...get().projectSettings,
        includeXdtsTrackPrefixInCellName,
      },
    })
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
      const parsed = JSON.parse(json) as Partial<ProjectSettings>
      const cellPrefixSeparator = resolveCellPrefixSeparator(parsed)
      get().pushHistory()
      set({
        projectSettings: {
          ...DEFAULT_PROJECT_SETTINGS,
          ...parsed,
          cellPrefixSeparator,
          animationSequenceSeparator: cellPrefixSeparator,
          includeXdtsTrackPrefixInCellName:
            resolveIncludeXdtsTrackPrefixInCellName(parsed),
          processTable: normalizeProcessTableColors(
            Array.isArray(parsed.processTable)
              ? parsed.processTable
              : DEFAULT_PROJECT_SETTINGS.processTable,
          ),
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
