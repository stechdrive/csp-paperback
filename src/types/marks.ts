export interface SingleMark {
  layerId: string
  origin: 'auto' | 'manual'
}

export interface VirtualSetMember {
  layerId: string
  blendMode: string | null  // null = レイヤー元の合成モードを使用
  opacity: number | null    // null = レイヤー元の不透明度を使用（0〜100）
}

export interface VirtualSetLayerOverride {
  blendMode?: string
  opacity?: number
}

/** Source references and local folders; source artwork is never moved or copied. */
export interface VirtualSetNode {
  layerId: string
  name?: string              // 仮想セル内の名前。省略時は元素材の名前
  virtualFolder?: true       // 元素材を参照しない新規フォルダ（layerId は固有ID）
  children: VirtualSetNode[]
}

export interface VirtualSetDropTarget {
  /** null means the end of the virtual document's root. */
  layerId: string | null
  position: 'above' | 'below' | 'inside'
}

export interface VirtualSet {
  id: string
  name: string
  insertionLayerId: string | null  // 差し込み階層位置のレイヤーID（未設定はnull）
  insertionPosition: 'above' | 'below' // insertionLayerIdの上/下どちらに差し込むか
  members: VirtualSetMember[]    // メンバーレイヤー一覧（フォルダも可）
  tree?: VirtualSetNode[]        // 編集後の独立した階層。省略時は元素材の階層を使う
  layerOverrides?: Record<string, VirtualSetLayerOverride> // 仮想セル内だけの layerId → 合成設定
  expandToAnimationCells: boolean // 差し込み位置がアニメフォルダなら全セルに展開
  // VirtualSet 側は visible の意味。グローバル store の visibilityOverrides(uiHidden) とは逆。
  visibilityOverrides: Record<string, boolean> // layerId → 表示(true)/非表示(false)
}
