export interface AnimationFolderInfo {
  detectedBy: 'xdts' | 'manual'
  trackName: string
  /** XDTS の trackNo。manual 指定では未設定。 */
  trackNo?: number
}

export interface AnimationCell {
  layerId: string
  cellName: string
  sequenceNumber: number
}
