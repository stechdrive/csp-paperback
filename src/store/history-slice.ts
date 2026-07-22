import type { StateCreator } from 'zustand'
import type { SingleMark, VirtualSet, ProjectSettings, OutputConfig, CspLayer, BlendMode } from '../types'
import type { AppStore } from './index'

const MAX_HISTORY = 50

export interface HistoryOptions {
  recordHistory?: boolean
}

interface LayerAppearance {
  blendMode: BlendMode
  opacity: number
}

/** アンドゥ/リドゥで復元する状態のスナップショット */
export interface UndoableState {
  singleMarks: Map<string, SingleMark>
  virtualSets: VirtualSet[]
  manualAnimFolderIds: Set<string>
  projectSettings: ProjectSettings
  visibilityOverrides: Map<string, boolean>
  outputConfig: OutputConfig
  layerAppearances: Map<string, LayerAppearance>
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
      layerOverrides: Object.fromEntries(
        Object.entries(vs.layerOverrides ?? {}).map(([layerId, override]) => [
          layerId,
          { ...override },
        ]),
      ),
      visibilityOverrides: { ...vs.visibilityOverrides },
    })),
    manualAnimFolderIds: new Set(s.manualAnimFolderIds),
    projectSettings: {
      ...s.projectSettings,
      processTable: s.projectSettings.processTable.map(e => ({
        ...e,
        folderNames: [...e.folderNames],
      })),
      autoMarkFolderNames: [...s.projectSettings.autoMarkFolderNames],
      archivePatterns: [...s.projectSettings.archivePatterns],
    },
    visibilityOverrides: new Map(s.visibilityOverrides),
    outputConfig: { ...s.outputConfig },
    layerAppearances: collectLayerAppearances(s.layerTree),
  }
}

function collectLayerAppearances(layers: CspLayer[]): Map<string, LayerAppearance> {
  const result = new Map<string, LayerAppearance>()
  const walk = (items: CspLayer[]) => {
    for (const layer of items) {
      result.set(layer.id, {
        blendMode: layer.blendMode,
        opacity: layer.opacity,
      })
      walk(layer.children)
    }
  }
  walk(layers)
  return result
}

function restoreLayerAppearances(
  layers: CspLayer[],
  appearances: Map<string, LayerAppearance>,
): CspLayer[] {
  let changed = false
  const next = layers.map(layer => {
    const restoredChildren = restoreLayerAppearances(layer.children, appearances)
    const childrenChanged = restoredChildren !== layer.children
    const appearance = appearances.get(layer.id)
    let restoredLayer = childrenChanged ? { ...layer, children: restoredChildren } : layer

    if (
      appearance &&
      (layer.blendMode !== appearance.blendMode || layer.opacity !== appearance.opacity)
    ) {
      restoredLayer.agPsdRef.blendMode = appearance.blendMode
      restoredLayer.agPsdRef.opacity = appearance.opacity / 100
      restoredLayer = {
        ...restoredLayer,
        blendMode: appearance.blendMode,
        opacity: appearance.opacity,
      }
      changed = true
    }

    if (childrenChanged) changed = true
    return restoredLayer
  })

  return changed ? next : layers
}

function restoreSnapshot(
  set: (partial: Partial<AppStore>) => void,
  current: AppStore,
  state: UndoableState,
  historyState: Pick<HistorySlice, '_past' | '_future' | 'canUndo' | 'canRedo'>,
): void {
  const selectedVirtualSetId = state.virtualSets.some(vs => vs.id === current.selectedVirtualSetId)
    ? current.selectedVirtualSetId
    : null
  const selectedVsMemberSetId = state.virtualSets.some(vs => vs.id === current.selectedVsMemberSetId)
    ? current.selectedVsMemberSetId
    : null

  set({
    singleMarks: state.singleMarks,
    virtualSets: state.virtualSets,
    manualAnimFolderIds: state.manualAnimFolderIds,
    projectSettings: state.projectSettings,
    visibilityOverrides: state.visibilityOverrides,
    outputConfig: state.outputConfig,
    savedOutputConfig: state.outputConfig,
    layerTree: restoreLayerAppearances(current.layerTree, state.layerAppearances),
    selectedVirtualSetId,
    selectedVsMemberSetId,
    selectedVsMemberId: selectedVsMemberSetId ? current.selectedVsMemberId : null,
    ...historyState,
  })
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
    restoreSnapshot(set, get(), prev, {
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
    restoreSnapshot(set, get(), next, {
      _past: newPast,
      _future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
    })
  },
})
