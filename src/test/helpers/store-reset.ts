import { DEFAULT_APP_THEME } from '../../theme'
import { useAppStore, type AppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS } from '../../types'
import { DEFAULT_MOBILE_UI_SCALE } from '../../utils/mobile-ui-scale'

const STORAGE_KEY = 'csp-paperback:settings'

export function cloneDefaultProjectSettings() {
  return {
    ...DEFAULT_PROJECT_SETTINGS,
    processTable: DEFAULT_PROJECT_SETTINGS.processTable.map(entry => ({
      ...entry,
      folderNames: [...entry.folderNames],
    })),
    autoMarkFolderNames: [...DEFAULT_PROJECT_SETTINGS.autoMarkFolderNames],
    archivePatterns: [...DEFAULT_PROJECT_SETTINGS.archivePatterns],
  }
}

export function cloneDefaultOutputConfig() {
  return {
    ...DEFAULT_OUTPUT_CONFIG,
    excludedProcessSuffixes: [...DEFAULT_OUTPUT_CONFIG.excludedProcessSuffixes],
  }
}

/**
 * Zustand の共有ストアを、永続設定も含めて各テストで同じ初期状態へ戻す。
 * resetProject() は製品仕様として projectSettings を保持するため、テストでは
 * その後に共有設定を明示的に初期化する。
 */
export function resetTestStore(overrides: Partial<AppStore> = {}): void {
  useAppStore.getState().resetProject()
  useAppStore.setState({
    projectSettings: cloneDefaultProjectSettings(),
    outputConfig: cloneDefaultOutputConfig(),
    savedOutputConfig: cloneDefaultOutputConfig(),
    mobileUiScale: DEFAULT_MOBILE_UI_SCALE,
    activeTheme: DEFAULT_APP_THEME,
    ...overrides,
  })
  localStorage.removeItem(STORAGE_KEY)
}
