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
} from '../types'
import { buildDefaultVisibilityOverrides, retainManualVisibility } from '../utils/default-visibility'
import { normalizeProcessTable } from '../utils/process-table'
import type { AppStore } from './index'
import { MAX_SETTINGS_JSON_LENGTH, validateProjectSettings } from '../utils/settings-validation'

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
  setShowIndividualFoldersOnLoad: (enabled: boolean) => void
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
        processTable: normalizeProcessTable(table),
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
    const { projectSettings, layerTree, timelineData } = get()
    if (!!projectSettings.sharedCutMode === enabled) return

    get().pushHistory()
    const nextSettings = { ...projectSettings, sharedCutMode: enabled }
    const nextState: Partial<AppStore> = { projectSettings: nextSettings }

    if (layerTree.length > 0) {
      nextState.visibilityOverrides = retainManualVisibility(buildDefaultVisibilityOverrides(layerTree, timelineData, enabled,
        projectSettings.showIndividualFoldersOnLoad !== false), get().visibilityOverrides, get().manualVisibilityIds)
    }

    set(nextState as AppStore)
  },

  updateAutoMarkFolderNames: (names) => {
    get().pushHistory()
    set({ projectSettings: { ...get().projectSettings, autoMarkFolderNames: names } })
  },

  setShowIndividualFoldersOnLoad: (showIndividualFoldersOnLoad) => {
    get().pushHistory()
    set({ projectSettings: { ...get().projectSettings, showIndividualFoldersOnLoad } })
  },

  updateArchivePatterns: (patterns) => {
    get().pushHistory()
    set({ projectSettings: { ...get().projectSettings, archivePatterns: patterns } })
  },

  importSettings: (json) => {
    if (json.length > MAX_SETTINGS_JSON_LENGTH) throw new Error('設定JSONが大きすぎます（1 Mi文字まで）')
    const projectSettings = validateProjectSettings(JSON.parse(json), true)
    get().pushHistory()
    set({ projectSettings })
  },

  exportSettings: () => {
    return JSON.stringify(get().projectSettings, null, 2)
  },
})
