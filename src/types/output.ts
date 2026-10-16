export type OutputFormat = 'jpg' | 'png'
export type BackgroundMode = 'white' | 'transparent'
export type StructureMode = 'hierarchy' | 'flat'
export type ProcessSuffixPosition = 'after-cell' | 'before-cell'
export type OutputDestination = 'zip' | 'directory'

export interface OutputConfig {
  format: OutputFormat
  jpgQuality: number        // 0.0 - 1.0
  background: BackgroundMode
  structure: StructureMode
  processSuffixPosition: ProcessSuffixPosition // 工程サフィックスの挿入位置
  excludedProcessSuffixes: string[]  // 出力から除外する工程サフィックス
  excludeAutoMarked: boolean         // 旧設定互換: 名前で指定された個別書き出しの既定値
  excludeBody?: boolean              // 修正工程に属さない作画本体だけを除外
  individualOutputOverrides?: Record<string, boolean> // 正規化した素材名 → 出力ON/OFF
  revisionBorderEnabled: boolean     // 修正工程画像の外周に確認用フチを合成
}

export const DEFAULT_OUTPUT_CONFIG: OutputConfig = {
  format: 'jpg',
  jpgQuality: 0.92,
  background: 'white',
  structure: 'flat',
  processSuffixPosition: 'after-cell',
  excludedProcessSuffixes: [],
  excludeAutoMarked: false,
  excludeBody: false,
  individualOutputOverrides: {},
  revisionBorderEnabled: true,
}

export interface OutputEntry {
  /** Names resolved against the complete export plan, before subset selection. */
  prepared?: import('../utils/output-builder').PreparedOutputEntry
  path: string              // 階層保持モード用のパス（例: 'A/A0001.jpg'）
  flatName: string          // フラット展開モード用のファイル名
  canvas: HTMLCanvasElement
  sourceLayerId: string
  sourceCellId?: string     // アニメセル由来のエントリの場合、その直接セルレイヤー/フォルダID
  processSuffixes?: string[] // 工程由来のエントリ判定用（親工程 + セル内工程）
}

/** Lazy entries own their rendered canvas; the encoder releases it after each file. */
export type ExportEntry = OutputEntry | (Omit<OutputEntry, 'canvas'> & {
  createCanvas: () => HTMLCanvasElement
  releaseRenderCache?: () => void
})
export interface ExportProgressDetail {
  phase: 'rendering' | 'encoding' | 'writing'
  path: string
}
export type ExportProgressCallback = (done: number, total: number, detail?: ExportProgressDetail) => void
