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
  excludeAutoMarked: boolean         // _プレフィックス自動マークレイヤーを除外
}

export const DEFAULT_OUTPUT_CONFIG: OutputConfig = {
  format: 'jpg',
  jpgQuality: 0.92,
  background: 'white',
  structure: 'flat',
  processSuffixPosition: 'after-cell',
  excludedProcessSuffixes: [],
  excludeAutoMarked: false,
}

export interface OutputEntry {
  path: string              // 階層保持モード用のパス（例: 'A/A0001.jpg'）
  flatName: string          // フラット展開モード用のファイル名
  canvas: HTMLCanvasElement
  sourceLayerId: string
  sourceCellId?: string     // アニメセル由来のエントリの場合、その直接セルレイヤー/フォルダID
  processSuffixes?: string[] // 工程由来のエントリ判定用（親工程 + セル内工程）
}
