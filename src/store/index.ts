import { create } from 'zustand'
import { createJSONStorage, persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
import {
  DEFAULT_OUTPUT_CONFIG,
  DEFAULT_PROJECT_SETTINGS,
} from '../types'
import { createPsdSlice, type PsdSlice } from './psd-slice'
import { createXdtsSlice, type XdtsSlice } from './xdts-slice'
import { createClipSlice, type ClipSlice } from './clip-slice'
import { createAnimationSlice, type AnimationSlice } from './animation-slice'
import { createMarksSlice, type MarksSlice } from './marks-slice'
import { createProjectSlice, type ProjectSlice } from './project-slice'
import { createOutputSlice, type OutputSlice } from './output-slice'
import { createUiSlice, type UiSlice } from './ui-slice'
import { createHistorySlice, type HistorySlice } from './history-slice'
import { createOutputGateSlice, type OutputGateSlice } from './output-gate-slice'
import { createOutputAliasSlice, type OutputAliasSlice } from './output-alias-slice'
import { DEFAULT_MOBILE_UI_SCALE, clampMobileUiScale } from '../utils/mobile-ui-scale'
import { DEFAULT_APP_THEME, isAppTheme } from '../theme'
import { validateProjectSettings, validateOutputConfig } from '../utils/settings-validation'

export type AppStore =
  PsdSlice &
  XdtsSlice &
  ClipSlice &
  AnimationSlice &
  MarksSlice &
  ProjectSlice &
  OutputSlice &
  UiSlice &
  OutputGateSlice &
  OutputAliasSlice &
  HistorySlice

type PersistedSettings = {
  directoryExportMode?: unknown
  projectSettings?: Partial<typeof DEFAULT_PROJECT_SETTINGS>
  savedOutputConfig?: typeof DEFAULT_OUTPUT_CONFIG
  quickExportConfig?: typeof DEFAULT_OUTPUT_CONFIG
  mobileUiScale?: number
  activeTheme?: unknown
}

const jsonStorage = createJSONStorage<PersistedSettings>(() => localStorage)
let lastSaved: StorageValue<PersistedSettings> | undefined
const settingsStorage: PersistStorage<PersistedSettings> | undefined = jsonStorage && {
  getItem: name => { lastSaved = undefined; return jsonStorage.getItem(name) },
  removeItem: name => { lastSaved = undefined; return jsonStorage.removeItem(name) },
  setItem: (name, value) => {
    // These settings are immutable. UI-only changes should not serialize or write them.
    if (lastSaved?.version === value.version && Object.keys(value.state).every(key =>
      value.state[key as keyof PersistedSettings] === lastSaved!.state[key as keyof PersistedSettings])) return
    const result = jsonStorage.setItem(name, value)
    lastSaved = value
    return result
  },
}

export const useAppStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createPsdSlice(...a),
      ...createXdtsSlice(...a),
      ...createClipSlice(...a),
      ...createAnimationSlice(...a),
      ...createMarksSlice(...a),
      ...createProjectSlice(...a),
      ...createOutputSlice(...a),
      ...createUiSlice(...a),
      ...createHistorySlice(...a),
      ...createOutputGateSlice(...a),
      ...createOutputAliasSlice(...a),
    }),
    {
      name: 'csp-paperback:settings',
      storage: settingsStorage,
      version: 2,
      // merge normalizes legacy names; a migration also writes them back to storage.
      migrate: persisted => persisted as PersistedSettings,
      partialize: (state): PersistedSettings => ({
        directoryExportMode: state.directoryExportMode,
        projectSettings: state.projectSettings,
        savedOutputConfig: state.savedOutputConfig,
        mobileUiScale: state.mobileUiScale,
        activeTheme: state.activeTheme,
      }),
      merge: (persisted, current) => {
        const p = persisted as PersistedSettings | undefined
        const persistedTheme = p?.activeTheme
        const persistedProjectSettings = p?.projectSettings
        const persistedOutputConfig = p?.savedOutputConfig ?? p?.quickExportConfig
        return {
          ...current,
          directoryExportMode: p?.directoryExportMode === 'direct-flat' ? 'direct-flat' : 'subfolder',
          projectSettings: validateProjectSettings(persistedProjectSettings),
          savedOutputConfig: validateOutputConfig(persistedOutputConfig),
          mobileUiScale: clampMobileUiScale(typeof p?.mobileUiScale === 'number' && Number.isFinite(p.mobileUiScale) ? p.mobileUiScale : DEFAULT_MOBILE_UI_SCALE),
          activeTheme: isAppTheme(persistedTheme) ? persistedTheme : DEFAULT_APP_THEME,
        }
      },
    },
  ),
)
