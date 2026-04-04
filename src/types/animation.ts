export type AnimationFolderMode = 'normal' | 'cell-inclusive'

export interface AnimationFolderInfo {
  mode: AnimationFolderMode
  detectedBy: 'xdts' | 'manual'
  trackName: string
}

export interface AnimationCell {
  layerId: string
  cellName: string
  sequenceNumber: number
}
