import type { StateCreator } from 'zustand'
import type { OutputConfig, OutputFormat, BackgroundMode, StructureMode, OutputScope } from '../types'
import { DEFAULT_OUTPUT_CONFIG } from '../types'
import type { AppStore } from './index'

export interface OutputSlice {
  outputConfig: OutputConfig
  setFormat: (format: OutputFormat) => void
  setBackground: (bg: BackgroundMode) => void
  setStructure: (mode: StructureMode) => void
  setScope: (scope: OutputScope) => void
  setJpgQuality: (quality: number) => void
}

export const createOutputSlice: StateCreator<AppStore, [], [], OutputSlice> = (set, get) => ({
  outputConfig: DEFAULT_OUTPUT_CONFIG,

  setFormat: (format) => {
    const current = get().outputConfig
    set({
      outputConfig: {
        ...current,
        format,
        // JPG選択時は透明背景を強制的に白に
        background: format === 'jpg' ? 'white' : current.background,
      },
    })
  },

  setBackground: (background) => {
    const current = get().outputConfig
    // JPGのときは透明を選べない
    if (current.format === 'jpg' && background === 'transparent') return
    set({ outputConfig: { ...current, background } })
  },

  setStructure: (structure) => {
    set({ outputConfig: { ...get().outputConfig, structure } })
  },

  setScope: (scope) => {
    set({ outputConfig: { ...get().outputConfig, scope } })
  },

  setJpgQuality: (jpgQuality) => {
    set({ outputConfig: { ...get().outputConfig, jpgQuality: Math.max(0, Math.min(1, jpgQuality)) } })
  },
})
