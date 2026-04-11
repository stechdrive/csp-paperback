import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_PROJECT_SETTINGS } from '../types'
import { createPsdSlice, type PsdSlice } from './psd-slice'
import { createXdtsSlice, type XdtsSlice } from './xdts-slice'
import { createAnimationSlice, type AnimationSlice } from './animation-slice'
import { createMarksSlice, type MarksSlice } from './marks-slice'
import { createProjectSlice, type ProjectSlice } from './project-slice'
import { createOutputSlice, type OutputSlice } from './output-slice'
import { createUiSlice, type UiSlice } from './ui-slice'
import { createHistorySlice, type HistorySlice } from './history-slice'
import { DEFAULT_MOBILE_UI_SCALE, clampMobileUiScale } from '../utils/mobile-ui-scale'

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
      partialize: (state) => ({
        projectSettings: state.projectSettings,
        mobileUiScale: state.mobileUiScale,
      }),
      merge: (persisted, current) => {
        const p = persisted as {
          projectSettings?: typeof DEFAULT_PROJECT_SETTINGS
          mobileUiScale?: number
        } | undefined
        return {
          ...current,
          projectSettings: { ...DEFAULT_PROJECT_SETTINGS, ...p?.projectSettings },
          mobileUiScale: clampMobileUiScale(p?.mobileUiScale ?? DEFAULT_MOBILE_UI_SCALE),
        }
      },
    },
  ),
)
