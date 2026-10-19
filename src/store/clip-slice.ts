import type { StateCreator } from 'zustand'
import type { Psd } from 'ag-psd'
import type { CspLayer } from '../types'
import type { ClipDocument, ClipDiagnostic, ClipLayer } from '../utils/clip/types'
import { buildClipLayerTree, clipRenderingSource } from '../engine/clip-tree'
import { buildDefaultVisibilityOverrides, retainManualVisibility } from '../utils/default-visibility'
import type { AppStore } from './index'
import { resolveClipDiagnostics } from '../utils/clip/rendering-status'
import { clearProjectSelectorCaches } from './selectors'
import { outputRenderQueue } from '../utils/output-render-queue'

export interface ClipPsdSource { psd: Psd; name: string; sourceDirectory?: string }
export interface ClipSlice {
  clipDocument: ClipDocument | null
  clipFileName: string | null
  clipSourceDirectory: string | null
  clipTimelineId: number | null
  clipDiagnostics: ClipDiagnostic[]
  loadClip: (clip: ClipDocument, name: string, sourceDirectory?: string, psd?: ClipPsdSource) => void
  attachClipPsd: (source: ClipPsdSource) => void
  selectClipTimeline: (id: number) => void
}

function flatten(layers: CspLayer[]): CspLayer[] {
  return layers.flatMap(l => [l, ...flatten(l.children)])
}

function metadataOnly(layers: ClipLayer[]): ClipLayer[] {
  return layers.map(layer => ({ ...layer, pixels: undefined, mask: undefined, fragments: undefined, children: metadataOnly(layer.children) }))
}

export const createClipSlice: StateCreator<AppStore, [], [], ClipSlice> = (set, get) => ({
  clipDocument: null,
  clipFileName: null,
  clipSourceDirectory: null,
  clipTimelineId: null,
  clipDiagnostics: [],

  loadClip: (clip, name, sourceDirectory, psd) => {
    const timeline = clip.timelines.find(t => t.id === clip.defaultTimelineId)
    const source = psd?.psd ?? clipRenderingSource(clip)
    // Detect shared cuts only on import, preserving later manual choices.
    const projectSettings = clip.timelines.length > 1
      ? { ...get().projectSettings, sharedCutMode: true }
      : get().projectSettings
    // Build and validate before resetting the current project.
    const tree = buildClipLayerTree(clip, source, timeline, projectSettings, !!psd)
    const all = flatten(tree)
    get().resetProject()
    set({
      projectSettings,
      // Canvases own the decoded pixels now. Retain only identities and metadata for later pairing.
      clipDocument: { ...clip, layers: metadataOnly(clip.layers) }, clipFileName: name, clipSourceDirectory: sourceDirectory ?? null,
      clipTimelineId: timeline?.id ?? null,
      clipDiagnostics: [...resolveClipDiagnostics(clip, tree, !!psd), ...(timeline?.diagnostics ?? [])],
      rawPsd: source, psdFileName: psd?.name ?? null, psdSourceDirectory: psd?.sourceDirectory ?? null,
      layerTree: tree, docWidth: clip.width, docHeight: clip.height, docDpiX: clip.dpi, docDpiY: clip.dpi,
      // Shared timeline representation. xdtsFileName remains null for a native timeline.
      timelineData: timeline?.data ?? null,
      visibilityOverrides: buildDefaultVisibilityOverrides(tree, timeline?.data, !!projectSettings.sharedCutMode,
        projectSettings.showIndividualFoldersOnLoad !== false),
      expandedFolders: new Set(all.filter(l => l.isFolder && l.expanded).map(l => l.id)),
      focusedAnimFolderId: all.find(l => l.isAnimationFolder)?.id ?? null,
    })
    if (timeline) get().seekToFrame(0)
  },

  attachClipPsd: ({ psd, name, sourceDirectory }) => {
    const state = get(), clip = state.clipDocument
    if (!clip) throw new Error('CLIPが読み込まれていません')
    const timeline = clip.timelines.find(t => t.id === state.clipTimelineId)
    const tree = buildClipLayerTree(clip, psd, timeline, state.projectSettings)
    outputRenderQueue.clear()
    clearProjectSelectorCaches()
    // Stable native IDs preserve marks, virtual sets, selections and process settings.
    // Render attributes and masks come entirely from the corresponding native PSD.
    set({ rawPsd: psd, psdFileName: name, psdSourceDirectory: sourceDirectory ?? null, layerTree: tree,
      clipDiagnostics: [...resolveClipDiagnostics(clip, tree, true), ...(timeline?.diagnostics ?? [])],
      _past: [], _future: [], canUndo: false, canRedo: false })
  },

  selectClipTimeline: (id) => {
    const state = get(), clip = state.clipDocument
    const timeline = clip?.timelines.find(t => t.id === id)
    if (!clip || !timeline) return
    const bind = (layers: CspLayer[]): CspLayer[] => layers.map(layer => ({ ...layer,
      animationFolder: layer.animationFolder?.detectedBy === 'clip'
        ? { ...layer.animationFolder, trackNo: timeline.bindings[layer.id.slice(5)] }
        : layer.animationFolder,
      children: bind(layer.children),
    }))
    const tree = bind(state.layerTree)
    set({ layerTree: tree, timelineData: timeline.data, clipTimelineId: id,
      clipDiagnostics: [...resolveClipDiagnostics(clip, tree, !!state.psdFileName), ...timeline.diagnostics],
      visibilityOverrides: retainManualVisibility(buildDefaultVisibilityOverrides(tree, timeline.data, !!state.projectSettings.sharedCutMode,
        state.projectSettings.showIndividualFoldersOnLoad !== false), state.visibilityOverrides, state.manualVisibilityIds),
      selectedCells: new Map(), currentFrame: 0,
      _past: [], _future: [], canUndo: false, canRedo: false })
    get().seekToFrame(0)
  },
})
