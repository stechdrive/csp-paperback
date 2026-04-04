export interface AnimationFolderInfo {
  detectedBy: 'xdts' | 'manual'
  trackName: string
}

export interface AnimationCell {
  layerId: string
  cellName: string
  sequenceNumber: number
}
