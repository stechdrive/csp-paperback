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
}

export const createOutputSlice: StateCreator<AppStore, [], [], OutputSlice> = (set, get) => ({
  outputConfig: DEFAULT_OUTPUT_CONFIG,

  setFormat: (format) => {
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
    set({ outputConfig: { ...current, background } })
  },

  setStructure: (structure) => {
    set({ outputConfig: { ...get().outputConfig, structure } })
  },


  setJpgQuality: (jpgQuality) => {
    set({ outputConfig: { ...get().outputConfig, jpgQuality: Math.max(0, Math.min(1, jpgQuality)) } })
  },
})
