export interface XdtsFrame {
  frameIndex: number
  cellName: string | null  // null = SYMBOL_NULL_CELL（空コマ）
}

export interface XdtsTrack {
  name: string           // 生のトラック名（末尾空白等をそのまま保持。マッチ時に trim 正規化する）
  trackNo: number        // XDTS の層番号。公式仕様 *6: trackNo 0 = ボトムレイヤー
  cellNames: string[]    // 使用されているセル名一覧（SYMBOL_NULL_CELL/HYPHEN/TICK除外）。セル選択UI用
  frames: XdtsFrame[]    // フレームごとのセル割り当て。frameIndex 昇順。ホールド解決に使用
}

export interface XdtsData {
  tracks: XdtsTrack[]  // fieldId=0（CELL）のトラックのみ。同名トラックも全部保持する
  // xdts書き出し用メタデータ
  version: number                       // 公式 enum [5, 10]
  header: { cut: string; scene: string }
  timeTableName: string                 // timeTables[0].name
  duration: number                      // timeTables[0].duration（総コマ数）
  fps: number                           // フレームレート（非公式拡張フィールド frameRate、デフォルト24）
}
