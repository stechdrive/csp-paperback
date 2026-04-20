export interface AnimationFolderInfo {
  detectedBy: 'xdts' | 'manual' | 'autoProcess'
  trackName: string
  /** XDTS の trackNo。manual / autoProcess 指定では未設定。 */
  trackNo?: number
}

export interface AnimationCell {
  layerId: string
  cellName: string
  sequenceNumber: number
}
