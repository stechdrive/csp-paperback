import type { StateCreator } from 'zustand'
import type { SingleMark, VirtualSet, ProjectSettings, OutputConfig } from '../types'
import type { AppStore } from './index'

const MAX_HISTORY = 50

/** アンドゥ/リドゥで復元する状態のスナップショット */
export interface UndoableState {
  singleMarks: Map<string, SingleMark>
  virtualSets: VirtualSet[]
  manualAnimFolderIds: Set<string>
  projectSettings: ProjectSettings
  visibilityOverrides: Map<string, boolean>
  outputConfig: OutputConfig
}

export interface HistorySlice {
  _past: UndoableState[]
  _future: UndoableState[]
  canUndo: boolean
  canRedo: boolean
  pushHistory: () => void   // アンドゥ可能な変更の直前に呼ぶ
  clearHistory: () => void  // PSDロード時などに呼ぶ
  undo: () => void
  redo: () => void
}

/** 現在の undoable state を deep copy してスナップショットを返す */
function snapshot(s: AppStore): UndoableState {
  return {
    singleMarks: new Map(s.singleMarks),
    virtualSets: s.virtualSets.map(vs => ({
      ...vs,
      members: vs.members.map(m => ({ ...m })),
      visibilityOverrides: { ...vs.visibilityOverrides },
    })),
    manualAnimFolderIds: new Set(s.manualAnimFolderIds),
    projectSettings: {
      ...s.projectSettings,
      processTable: s.projectSettings.processTable.map(e => ({
        ...e,
        folderNames: [...e.folderNames],
      })),
    },
    visibilityOverrides: new Map(s.visibilityOverrides),
    outputConfig: { ...s.outputConfig },
  }
}

export const createHistorySlice: StateCreator<AppStore, [], [], HistorySlice> = (set, get) => ({
  _past: [],
  _future: [],
  canUndo: false,
  canRedo: false,

  pushHistory: () => {
    const past = [...get()._past, snapshot(get())].slice(-MAX_HISTORY)
    set({ _past: past, _future: [], canUndo: true, canRedo: false })
  },

  clearHistory: () => {
    set({ _past: [], _future: [], canUndo: false, canRedo: false })
  },

  undo: () => {
    const { _past, _future } = get()
    if (_past.length === 0) return
    const current = snapshot(get())
    const prev = _past[_past.length - 1]
    const newPast = _past.slice(0, -1)
    const newFuture = [current, ..._future].slice(0, MAX_HISTORY)
    set({
      ...prev,
      _past: newPast,
      _future: newFuture,
      canUndo: newPast.length > 0,
      canRedo: true,
    })
  },

  redo: () => {
    const { _past, _future } = get()
    if (_future.length === 0) return
    const current = snapshot(get())
    const next = _future[0]
    const newPast = [..._past, current].slice(-MAX_HISTORY)
    const newFuture = _future.slice(1)
    set({
      ...next,
      _past: newPast,
      _future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
    })
  },
})
