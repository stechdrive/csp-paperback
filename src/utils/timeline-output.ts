import type { CspLayer, ProjectSettings, TimelineData, TimelineTrack } from '../types'
import type { ClipDiagnostic, ClipDocument, ClipLayer, ClipTimeline } from './clip/types'

export interface TimelineOutputState {
  clipDocument?: ClipDocument | null
  clipTimelineId?: number | null
  projectSettings: Pick<ProjectSettings, 'sharedCutMode'>
}

export interface TimelineOutputPolicy {
  /** Only proven-unused native cels. Keep the material tree and virtual references intact. */
  excludedCellIds: ReadonlySet<string>
  /** Native file order, independent of the currently selected playback timeline. */
  timelines: readonly ClipTimeline[]
  diagnostics: readonly ClipDiagnostic[]
}

export function isSharedCutMode(state: TimelineOutputState): boolean {
  return !!state.projectSettings.sharedCutMode && (state.clipDocument?.timelines.length ?? 0) > 1
}

const emptyPolicy: TimelineOutputPolicy = { excludedCellIds: new Set(), timelines: [], diagnostics: [] }
const policies = new WeakMap<ClipDocument, Map<number | 'shared', TimelineOutputPolicy>>()

/** Saved assignments count even outside playback; cel lookup follows timeline seeking. */
export function timelineCellIds(folder: CspLayer, track: TimelineTrack): Set<string> {
  return referencedIds(folder.children, child => child.originalName, track)
}

function referencedIds<T extends { id: string }>(children: T[], nameOf: (child: T) => string, track: TimelineTrack): Set<string> {
  const names = new Set([...track.cellNames, ...track.frames.flatMap(f => f.cellName === null ? [] : [f.cellName])])
  return new Set([...names].flatMap(name => {
    const cell = children.findLast(child => nameOf(child) === name)
    return cell ? [cell.id] : []
  }))
}

export function timelineOutputPolicy(state: TimelineOutputState): TimelineOutputPolicy {
  const clip = state.clipDocument
  if (!clip?.timelines.length) return emptyPolicy
  const selected = clip.timelines.find(t => t.id === state.clipTimelineId)
    ?? clip.timelines.find(t => t.id === clip.defaultTimelineId) ?? clip.timelines[0]
  const key = isSharedCutMode(state) ? 'shared' : selected.id
  let cache = policies.get(clip)
  if (!cache) { cache = new Map(); policies.set(clip, cache) }
  const cached = cache.get(key)
  if (cached) return cached
  const timelines = key === 'shared' ? clip.timelines : [selected]
  const excludedCellIds = new Set<string>()
  const walk = (layers: ClipLayer[]) => {
    for (const folder of layers) {
      if (folder.isAnimationFolder) {
        const used = new Set<string>()
        let unknown = false
        for (const timeline of timelines) {
          // A skipped/unreadable track must not be mistaken for an empty track.
          if (timeline.diagnostics.some(d => !d.layerId || d.layerId === folder.id)) unknown = true
          const trackNo = timeline.bindings[folder.id]
          const track = timeline.data.tracks.find(t => t.trackNo === trackNo)
          if (trackNo !== undefined && !track) unknown = true
          if (!track) continue
          for (const id of referencedIds(folder.children, child => child.name, track)) used.add(id)
        }
        if (!unknown) for (const cell of folder.children) if (!used.has(cell.id)) excludedCellIds.add(`clip:${cell.id}`)
      }
      walk(folder.children)
    }
  }
  walk(clip.layers)
  const result = { excludedCellIds, timelines, diagnostics: timelines.flatMap(t => t.diagnostics) }
  cache.set(key, result)
  return result
}

/** Use UUID bindings for every timeline, never the active timeline's track number. */
export function outputTimelineTrack(folder: CspLayer, data: TimelineData, timeline?: ClipTimeline): TimelineTrack | undefined {
  const trackNo = timeline ? timeline.bindings[folder.id.slice(5)] : folder.animationFolder?.trackNo
  return typeof trackNo === 'number' ? data.tracks.find(t => t.trackNo === trackNo) : undefined
}
