/** Source-independent cel exposure data. Track numbers are identities, not display order. */
export interface TimelineFrame {
  frameIndex: number
  cellName: string | null
}

export interface TimelineTrack {
  name: string
  trackNo: number
  cellNames: string[]
  frames: TimelineFrame[]
}

export interface TimelineData {
  tracks: TimelineTrack[]
  duration: number
  fps: number
  timeTableName: string
  /** Retained for XDTS interchange. */
  version: number
  header: { cut: string; scene: string }
}
