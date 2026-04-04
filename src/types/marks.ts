export interface SingleMark {
  layerId: string
  origin: 'auto' | 'manual'
}

export interface VirtualSet {
  id: string
  name: string
  insertionLayerId: string    // 差し込み階層位置のレイヤーID
  memberLayerIds: string[]    // メンバーレイヤーのID一覧
  expandToAnimationCells: boolean // 差し込み位置がアニメフォルダなら全セルに展開
}
