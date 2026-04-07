import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_OUTPUT_CONFIG } from '../types'
import { createPsdSlice, type PsdSlice } from './psd-slice'
import { createXdtsSlice, type XdtsSlice } from './xdts-slice'
import { createAnimationSlice, type AnimationSlice } from './animation-slice'
import { createMarksSlice, type MarksSlice } from './marks-slice'
import { createProjectSlice, type ProjectSlice } from './project-slice'
import { createOutputSlice, type OutputSlice } from './output-slice'
import { createUiSlice, type UiSlice } from './ui-slice'
import { createHistorySlice, type HistorySlice } from './history-slice'

export type AppStore =
  PsdSlice &
  XdtsSlice &
  AnimationSlice &
  MarksSlice &
  ProjectSlice &
  OutputSlice &
  UiSlice &
  HistorySlice

export const useAppStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createPsdSlice(...a),
      ...createXdtsSlice(...a),
      ...createAnimationSlice(...a),
      ...createMarksSlice(...a),
      ...createProjectSlice(...a),
      ...createOutputSlice(...a),
      ...createUiSlice(...a),
      ...createHistorySlice(...a),
    }),
    {
      name: 'csp-paperback:settings',
      version: 1,
      partialize: (state) => ({ outputConfig: state.outputConfig }),
      merge: (persisted, current) => ({
        ...current,
        outputConfig: {
          ...DEFAULT_OUTPUT_CONFIG,
          ...(persisted as { outputConfig?: typeof DEFAULT_OUTPUT_CONFIG })?.outputConfig,
        },
      }),
    },
  ),
)
