export interface XdtsFrame {
  frameIndex: number
  cellName: string | null  // null = SYMBOL_NULL_CELL（空コマ）
}

export interface XdtsTrack {
  name: string
  cellNames: string[]    // 使用されているセル名一覧（SYMBOL_NULL_CELL除外）。セル選択UI用
  frames: XdtsFrame[]   // フレームごとのセル割り当て。ホールド解決に使用
}

export interface XdtsData {
  tracks: XdtsTrack[]  // fieldId=0（CELL）のトラックのみ
  // xdts書き出し用メタデータ
  version: number                       // 実ファイルでは 5
  header: { cut: string; scene: string }
  timeTableName: string                 // timeTables[0].name
  duration: number                      // timeTables[0].duration（総コマ数）
}
