import { create } from 'zustand'
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

export const useAppStore = create<AppStore>()((...a) => ({
  ...createPsdSlice(...a),
  ...createXdtsSlice(...a),
  ...createAnimationSlice(...a),
  ...createMarksSlice(...a),
  ...createProjectSlice(...a),
  ...createOutputSlice(...a),
  ...createUiSlice(...a),
  ...createHistorySlice(...a),
}))
