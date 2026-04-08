import type { StateCreator } from 'zustand'
import type { OutputConfig, OutputFormat, BackgroundMode, StructureMode } from '../types'
import { DEFAULT_OUTPUT_CONFIG } from '../types'
import type { AppStore } from './index'

export interface OutputSlice {
  outputConfig: OutputConfig
  setFormat: (format: OutputFormat) => void
  setBackground: (bg: BackgroundMode) => void
  setStructure: (mode: StructureMode) => void
  setJpgQuality: (quality: number) => void
  toggleProcessSuffixExclusion: (suffix: string) => void
  setAllProcessSuffixExclusions: (suffixes: string[]) => void
  setExcludeAutoMarked: (exclude: boolean) => void
}

export const createOutputSlice: StateCreator<AppStore, [], [], OutputSlice> = (set, get) => ({
  outputConfig: DEFAULT_OUTPUT_CONFIG,

  setFormat: (format) => {
    get().pushHistory()
    const current = get().outputConfig
    set({
      outputConfig: {
        ...current,
        format,
        // JPG選択時は白固定、PNG選択時は透明をデフォルトに
        background: format === 'jpg' ? 'white' : 'transparent',
      },
    })
  },

  setBackground: (background) => {
    const current = get().outputConfig
    // JPGのときは透明を選べない
    if (current.format === 'jpg' && background === 'transparent') return
    get().pushHistory()
    set({ outputConfig: { ...current, background } })
  },

  setStructure: (structure) => {
    get().pushHistory()
    set({ outputConfig: { ...get().outputConfig, structure } })
  },

  setJpgQuality: (jpgQuality) => {
    get().pushHistory()
    set({ outputConfig: { ...get().outputConfig, jpgQuality: Math.max(0, Math.min(1, jpgQuality)) } })
  },

  toggleProcessSuffixExclusion: (suffix) => {
    get().pushHistory()
    const current = get().outputConfig.excludedProcessSuffixes
    const next = current.includes(suffix)
      ? current.filter(s => s !== suffix)
      : [...current, suffix]
    set({ outputConfig: { ...get().outputConfig, excludedProcessSuffixes: next } })
  },

  setAllProcessSuffixExclusions: (suffixes) => {
    get().pushHistory()
    set({ outputConfig: { ...get().outputConfig, excludedProcessSuffixes: suffixes } })
  },

  setExcludeAutoMarked: (excludeAutoMarked) => {
    get().pushHistory()
    set({ outputConfig: { ...get().outputConfig, excludeAutoMarked } })
  },
})
