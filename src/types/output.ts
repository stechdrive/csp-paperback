export type OutputFormat = 'jpg' | 'png'
export type BackgroundMode = 'white' | 'transparent'
export type StructureMode = 'hierarchy' | 'flat'

export interface OutputConfig {
  format: OutputFormat
  jpgQuality: number        // 0.0 - 1.0
  background: BackgroundMode
  structure: StructureMode
}

export const DEFAULT_OUTPUT_CONFIG: OutputConfig = {
  format: 'jpg',
  jpgQuality: 0.92,
  background: 'white',
  structure: 'flat',
}

export interface OutputEntry {
  path: string              // 階層保持モード用のパス（例: 'A/A0001.jpg'）
  flatName: string          // フラット展開モード用のファイル名
  canvas: HTMLCanvasElement
  sourceLayerId: string
}
