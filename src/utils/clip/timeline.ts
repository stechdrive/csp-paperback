import { readCelFrames as native } from 'celcodec/read'
import { codecFunction } from './celcodec'
export const readCelFrames=codecFunction(native)

import { ClipError, type DocumentSession, type TimelineView } from 'celcodec'
import { codecDiagnostic } from './celcodec'
import type { ClipLayer, ClipTimeline } from './types'

/** Keep signed/fractional positions; the UI chooses which integer frames to display. */
export function projectTimeline(session: DocumentSession, view: TimelineView,
  layers: ReadonlyMap<string, ClipLayer>): ClipTimeline {
  const timeline: ClipTimeline = { id: view.nativeId, uuid: view.id, startFrame: view.startFrame,
    endFrame: view.endFrame, bindings: {}, diagnostics: [], otherTracks: [], data: {
      version: 10, header: { cut: '', scene: '' }, timeTableName: view.name,
      duration: view.durationFrames, fps: view.fps, tracks: [],
    } }
  const read = new Map(session.readTimeline(view.id).tracks.map(t => [t.trackId, t]))
  for (const track of view.tracks) {
    if (track.kind !== 2000) {
      timeline.otherTracks!.push({ id: track.id, layerId: track.layerId, kind: track.kind,
        role: track.kind === 2005 ? 'camera' : [1000, 2001, 2003].includes(track.kind) ? 'transform' : 'other' })
      continue
    }
    const layer = layers.get(track.layerId), result = read.get(track.id)!
    if (result.diagnostics.length) {
      timeline.diagnostics.push(...result.diagnostics.map(d => codecDiagnostic(d, layer, 'timeline')))
      continue
    }
    if (!layer?.isAnimationFolder || Object.hasOwn(timeline.bindings, track.layerId)) {
      timeline.diagnostics.push(codecDiagnostic(new ClipError(layer?.isAnimationFolder
        ? 'DUPLICATE_LAYER_TRACK' : 'MISSING_PARENT_LAYER').diagnostic, layer, 'timeline'))
      continue
    }
    // The cel API retains keys; the keyframe API supplies exclusive exposure ends,
    // including a final clip extending beyond playback. Neither value is rounded.
    const keyframes = session.readKeyframes(track.id, track.primary ? 'primary' : 'secondary')
    if (keyframes.diagnostics.length) {
      timeline.diagnostics.push(...keyframes.diagnostics.map(d => codecDiagnostic(d, layer, 'timeline')))
      continue
    }
    const events = new Map<number, string | null>(keyframes.clips.map(c => [c.endFrame, null]))
    for (const key of result.frames) events.set(key.frame, key.value)
    const frames = [...events].sort(([a], [b]) => a - b)
      .map(([frameIndex, cellName]) => ({ frameIndex, cellName }))
      .filter((key, i, all) => i === 0 || key.cellName !== all[i - 1].cellName)
    timeline.bindings[layer.id] = track.id
    timeline.data.tracks.push({ name: layer.name, trackNo: track.id, frames,
      cellNames: [...new Set(frames.flatMap(f => f.cellName === null ? [] : [f.cellName]))] })
  }
  return timeline
}
