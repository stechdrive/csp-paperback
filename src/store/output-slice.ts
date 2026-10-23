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
import { individualOutputKey } from '../utils/output-target'
import type { DirectoryExportMode } from '../types/output'

export type OutputConfigTarget = 'current' | 'saved'

export interface OutputSlice {
  directoryExportMode: DirectoryExportMode
  setDirectoryExportMode: (mode: DirectoryExportMode) => void
  outputConfig: OutputConfig
  savedOutputConfig: OutputConfig
  setFormat: (format: OutputFormat, target?: OutputConfigTarget) => void
  setBackground: (bg: BackgroundMode, target?: OutputConfigTarget) => void
  setStructure: (mode: StructureMode, target?: OutputConfigTarget) => void
  setProcessSuffixPosition: (position: ProcessSuffixPosition, target?: OutputConfigTarget) => void
  setJpgQuality: (quality: number, target?: OutputConfigTarget) => void
  toggleProcessSuffixExclusion: (suffix: string, target?: OutputConfigTarget) => void
  setProcessOutputEnabled: (suffix: string, enabled: boolean, legacyIndividualNames: string[], target?: OutputConfigTarget) => void
  setAllProcessSuffixExclusions: (suffixes: string[], target?: OutputConfigTarget) => void
  setExcludeAutoMarked: (exclude: boolean, target?: OutputConfigTarget) => void
  setExcludeBody: (exclude: boolean, target?: OutputConfigTarget) => void
  setIndividualOutputEnabled: (name: string, enabled: boolean, target?: OutputConfigTarget) => void
  setRevisionBorderEnabled: (enabled: boolean, target?: OutputConfigTarget) => void
}

export const createOutputSlice: StateCreator<AppStore, [], [], OutputSlice> = (set, get) => {
  const getTargetConfig = (target: OutputConfigTarget) => (
    target === 'saved' ? get().savedOutputConfig : get().outputConfig
  )

  const updateTargetConfig = (
    target: OutputConfigTarget,
    update: (current: OutputConfig) => OutputConfig,
  ) => {
    const outputConfig = update(getTargetConfig(target))
    if (target === 'saved') {
      set({ savedOutputConfig: outputConfig })
      return
    }

    get().pushHistory()
    set({ outputConfig, savedOutputConfig: outputConfig })
  }

  return {
    directoryExportMode: 'subfolder',
    setDirectoryExportMode: directoryExportMode => set({ directoryExportMode }),
    outputConfig: DEFAULT_OUTPUT_CONFIG,
    savedOutputConfig: DEFAULT_OUTPUT_CONFIG,

    setFormat: (format, target = 'current') => {
      updateTargetConfig(target, current => ({
        ...current,
        format,
        // JPG選択時は白固定、PNG選択時は透明をデフォルトに
        background: format === 'jpg' ? 'white' : 'transparent',
      }))
    },

    setBackground: (background, target = 'current') => {
      const current = getTargetConfig(target)
      // JPGのときは透明を選べない
      if (current.format === 'jpg' && background === 'transparent') return
      updateTargetConfig(target, config => ({ ...config, background }))
    },

    setStructure: (structure, target = 'current') => {
      updateTargetConfig(target, current => ({ ...current, structure }))
    },

    setProcessSuffixPosition: (processSuffixPosition, target = 'current') => {
      updateTargetConfig(target, current => ({ ...current, processSuffixPosition }))
    },

    setJpgQuality: (jpgQuality, target = 'current') => {
      updateTargetConfig(target, current => ({
        ...current,
        jpgQuality: Math.max(0, Math.min(1, jpgQuality)),
      }))
    },

    toggleProcessSuffixExclusion: (suffix, target = 'current') => {
      updateTargetConfig(target, current => {
        const excludedProcessSuffixes = current.excludedProcessSuffixes.includes(suffix)
          ? current.excludedProcessSuffixes.filter(entry => entry !== suffix)
          : [...current.excludedProcessSuffixes, suffix]
        return { ...current, excludedProcessSuffixes }
      })
    },

    setAllProcessSuffixExclusions: (suffixes, target = 'current') => {
      updateTargetConfig(target, current => ({
        ...current,
        excludedProcessSuffixes: suffixes,
      }))
    },

    setProcessOutputEnabled: (suffix, enabled, legacyIndividualNames, target = 'current') => {
      updateTargetConfig(target, current => ({
        ...current,
        excludedProcessSuffixes: enabled
          ? current.excludedProcessSuffixes.filter(entry => entry !== suffix)
          : [...new Set([...current.excludedProcessSuffixes, suffix])],
        individualOutputOverrides: {
          ...current.individualOutputOverrides,
          ...Object.fromEntries(legacyIndividualNames.map(name => [individualOutputKey(name), enabled])),
        },
      }))
    },

    setExcludeAutoMarked: (excludeAutoMarked, target = 'current') => {
      updateTargetConfig(target, current => ({ ...current, excludeAutoMarked }))
    },

    setExcludeBody: (excludeBody, target = 'current') => {
      updateTargetConfig(target, current => ({ ...current, excludeBody }))
    },

    setIndividualOutputEnabled: (name, enabled, target = 'current') => {
      updateTargetConfig(target, current => ({ ...current, individualOutputOverrides: {
        ...current.individualOutputOverrides, [individualOutputKey(name)]: enabled,
      } }))
    },

    setRevisionBorderEnabled: (revisionBorderEnabled, target = 'current') => {
      updateTargetConfig(target, current => ({ ...current, revisionBorderEnabled }))
    },
  }
}
