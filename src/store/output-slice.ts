import type { StateCreator } from 'zustand'
import type {
  OutputConfig,
  OutputFormat,
  BackgroundMode,
  StructureMode,
  ProcessSuffixPosition,
} from '../types'
import { DEFAULT_OUTPUT_CONFIG } from '../types'
import type { AppStore } from './index'

export interface OutputSlice {
  outputConfig: OutputConfig
  quickExportConfig: OutputConfig
  setFormat: (format: OutputFormat) => void
  setBackground: (bg: BackgroundMode) => void
  setStructure: (mode: StructureMode) => void
  setProcessSuffixPosition: (position: ProcessSuffixPosition) => void
  setJpgQuality: (quality: number) => void
  toggleProcessSuffixExclusion: (suffix: string) => void
  setAllProcessSuffixExclusions: (suffixes: string[]) => void
  setExcludeAutoMarked: (exclude: boolean) => void
}

export const createOutputSlice: StateCreator<AppStore, [], [], OutputSlice> = (set, get) => ({
  outputConfig: DEFAULT_OUTPUT_CONFIG,
  quickExportConfig: DEFAULT_OUTPUT_CONFIG,

  setFormat: (format) => {
    get().pushHistory()
    const current = get().outputConfig
    const background: BackgroundMode = format === 'jpg' ? 'white' : 'transparent'
    const outputConfig: OutputConfig = {
      ...current,
      format,
      // JPG選択時は白固定、PNG選択時は透明をデフォルトに
      background,
    }
    set({
      outputConfig,
      quickExportConfig: outputConfig,
    })
  },

  setBackground: (background) => {
    const current = get().outputConfig
    // JPGのときは透明を選べない
    if (current.format === 'jpg' && background === 'transparent') return
    get().pushHistory()
    const outputConfig = { ...current, background }
    set({ outputConfig, quickExportConfig: outputConfig })
  },

  setStructure: (structure) => {
    get().pushHistory()
    const outputConfig = { ...get().outputConfig, structure }
    set({ outputConfig, quickExportConfig: outputConfig })
  },

  setProcessSuffixPosition: (processSuffixPosition) => {
    get().pushHistory()
    const outputConfig = { ...get().outputConfig, processSuffixPosition }
    set({ outputConfig, quickExportConfig: outputConfig })
  },

  setJpgQuality: (jpgQuality) => {
    get().pushHistory()
    const outputConfig = {
      ...get().outputConfig,
      jpgQuality: Math.max(0, Math.min(1, jpgQuality)),
    }
    set({ outputConfig, quickExportConfig: outputConfig })
  },

  toggleProcessSuffixExclusion: (suffix) => {
    get().pushHistory()
    const current = get().outputConfig.excludedProcessSuffixes
    const next = current.includes(suffix)
      ? current.filter(s => s !== suffix)
      : [...current, suffix]
    const outputConfig = { ...get().outputConfig, excludedProcessSuffixes: next }
    set({ outputConfig, quickExportConfig: outputConfig })
  },

  setAllProcessSuffixExclusions: (suffixes) => {
    get().pushHistory()
    const outputConfig = { ...get().outputConfig, excludedProcessSuffixes: suffixes }
    set({ outputConfig, quickExportConfig: outputConfig })
  },

  setExcludeAutoMarked: (excludeAutoMarked) => {
    get().pushHistory()
    const outputConfig = { ...get().outputConfig, excludeAutoMarked }
    set({ outputConfig, quickExportConfig: outputConfig })
  },
})
