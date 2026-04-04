export interface SingleMark {
  layerId: string
  origin: 'auto' | 'manual'
}

export interface VirtualSetMember {
  layerId: string
  blendMode: string | null  // null = レイヤー元の合成モードを使用
}

export interface VirtualSet {
  id: string
  name: string
  insertionLayerId: string | null  // 差し込み階層位置のレイヤーID（未設定はnull）
  insertionPosition: 'above' | 'below' // insertionLayerIdの上/下どちらに差し込むか
  members: VirtualSetMember[]    // メンバーレイヤー一覧
  expandToAnimationCells: boolean // 差し込み位置がアニメフォルダなら全セルに展開
}
