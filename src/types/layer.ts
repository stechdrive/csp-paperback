import type { Layer, BlendMode } from 'ag-psd'
import type { AnimationFolderInfo } from './animation'

export type { BlendMode }

export interface CspLayer {
  id: string
  name: string             // 表示名（先頭の_を除去済み）
  originalName: string     // PSD上の元レイヤー名
  agPsdRef: Layer          // ag-psdの元レイヤー（canvasデータ等を保持）
  children: CspLayer[]
  parentId: string | null  // 循環参照回避のためIDで参照
  depth: number
  blendMode: BlendMode
  hidden: boolean
  clipping: boolean
  isFolder: boolean        // sectionDivider.type === 1 (open) or 2 (closed)
  isAnimationFolder: boolean
  top: number
  left: number
  width: number
  height: number
  animationFolder: AnimationFolderInfo | null
  singleMark: boolean
  autoMarked: boolean      // _プレフィックスによる自動マーク
  virtualSetMembership: string[]
  uiHidden: boolean        // UI上の表示切替（一時的、XMPに非永続）
  expanded: boolean        // レイヤーツリーUI展開状態
  hasAdjustmentLayer: boolean // 調整レイヤーを含む（v1では警告表示用）
}

export interface FlatLayer {
  canvas: HTMLCanvasElement
  blendMode: BlendMode
  top: number
  left: number
  sourceId: string
  clipping: boolean
}
