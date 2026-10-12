import type { BlendMode } from 'ag-psd'
import type { TimelineData } from '../../types/timeline'
import type { MaterialAdjustment, MaterialEffects, MaterialQuad, TextObject } from '../../types/rendering'

/** Data-only representation, transferred from the CLIP worker. Children are top first. */
export interface ClipPixels {
  width: number
  height: number
  left: number
  top: number
  rgba: Uint8ClampedArray
  defaultColor?: number
  disabled?: boolean
}

export interface ClipLayer {
  id: string
  name: string
  isFolder: boolean
  isAnimationFolder: boolean
  expanded: boolean
  hidden: boolean
  opacity: number
  blendMode: BlendMode
  clipping: boolean
  children: ClipLayer[]
  pixels?: ClipPixels
  fragments?: ClipPixels[]
  mask?: ClipPixels
  kind?: 'raster' | 'folder' | 'camera' | 'text' | 'image-material' | 'vector' | '3d' | 'adjustment' | 'other'
  nativeBlendMode?: number
  materialSource?: 'render' | 'timeline-original' | 'image-original' | 'object-cache' | 'text' | 'fill' | 'gradient' | 'adjustment' | 'vector'
  vectorRendering?: 'approximate' | 'unavailable'
  unsupported3D?: boolean
  placement?: MaterialQuad
  text?: TextObject[]
  effects?: MaterialEffects
  adjustment?: MaterialAdjustment
}

export interface ClipDiagnostic {
  scope: 'raster' | 'timeline'
  message: string
  layerId?: string
}

export interface ClipTimeline {
  id: number
  data: TimelineData
  /** Native layer identity -> track number; never a name-based guess. */
  bindings: Record<string, number>
  diagnostics: ClipDiagnostic[]
  /** Shooting animation is identified but never evaluated for material exports. */
  otherTracks?: { id: number; layerId: string; kind: number; role: 'camera' | 'transform' | 'other' }[]
}

export interface ClipDocument {
  width: number
  height: number
  dpi: number
  layers: ClipLayer[]
  timelines: ClipTimeline[]
  defaultTimelineId: number | null
  diagnostics: ClipDiagnostic[]
}
