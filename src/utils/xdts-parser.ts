import type { XdtsData, XdtsFrame, XdtsTrack } from '../types'

/**
 * XDTS の特殊シンボル（公式仕様書 *4）
 *
 * - SYMBOL_NULL_CELL: 空セル ×（Cell フィールド限定）
 * - SYMBOL_HYPHEN:    前の指示を継続（全フィールドで有効）
 * - SYMBOL_TICK_1:    中割り記号 ○（Cell フィールド限定、ラベル扱い）
 * - SYMBOL_TICK_2:    逆シート記号 ●（Cell フィールド限定、ラベル扱い）
 */
const SYMBOL_NULL_CELL = 'SYMBOL_NULL_CELL'
const SYMBOL_HYPHEN = 'SYMBOL_HYPHEN'
const SYMBOL_TICK_1 = 'SYMBOL_TICK_1'
const SYMBOL_TICK_2 = 'SYMBOL_TICK_2'

/**
 * xdtsファイルを解析してXdtsDataを返す
 *
 * 公式仕様: CLIP STUDIO PAINT / Celsys
 *   「XDTS file format」ver1.0 (2022/12/06)
 *   https://vd.clipstudio.net/clipcontent/paint/app/ToeiAnimation/XDTSFileFormat_ver10_en.pdf
 * 参照実装: opentoonz/xdts_viewer (sources/xdtsio.cpp,h)
 *
 * 1行目のテキストヘッダー "exchangeDigitalTimeSheet Save Data" を除去し、
 * 2行目以降のJSONをJSON Schema draft-07に沿って読み取る。
 *
 * JSON構造（抜粋）:
 *   timeTables[].timeTableHeaders[n].fieldId  → フィールド種別
 *   timeTables[].timeTableHeaders[n].names    → trackNoに対応するトラック名配列
 *   timeTables[].fields[n].fieldId            → フィールド種別（同上）
 *   timeTables[].fields[n].tracks[]
 *     .trackNo   → layer番号。仕様 *6: 0 = ボトムレイヤー
 *     .frames[].data[0].values[0]  → そのフレームで使用するセル名 or 特殊記号
 *
 * fieldId の種別（公式 *1）:
 *   0 = CELL       → アニメーションセルのトラック（本ツールの対象）
 *   3 = DIALOG     → セリフ
 *   5 = CAMERAWORK → カメラワーク
 *
 * 本パーサの挙動:
 * - fieldId=0 のトラックのみ対象
 * - **同名トラックも dedup せず全部保持**（trackNo で識別）
 * - SYMBOL_NULL_CELL → cellName: null（空セル）
 * - SYMBOL_HYPHEN / SYMBOL_TICK_1 / SYMBOL_TICK_2 → フレームをドロップ
 *   （resolveCellsAtFrame のホールドロジックで直前値が自然継続する）
 * - 負のフレーム番号（仕様外だが CSP がエクスポートすることがある、参照実装コメント参照）
 *   → そのまま保持する。resolveCellsAtFrame のバックワード走査で initial value として機能する
 * - frames は frameIndex 昇順でソート
 * - version enum は [5, 10]。未定義の値は console.warn するがパースは成功させる
 * - frameRate は公式スキーマに存在しない CSP 独自拡張。UI の秒数表示にしか使わないので
 *   読めれば使い、無ければデフォルト 24
 */
export function parseXdts(text: string): XdtsData {
  // 1行目のテキストヘッダーを除去してJSONを取り出す
  const newlineIndex = text.indexOf('\n')
  const jsonText = newlineIndex !== -1 ? text.slice(newlineIndex + 1) : text

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any
  try {
    data = JSON.parse(jsonText.trim())
  } catch (e) {
    throw new Error(`xdtsのJSON解析に失敗しました: ${e}`)
  }

  // ドキュメントレベルのメタデータ（最初のtimeTableを使用）
  const firstTable = data.timeTables?.[0]
  const version: number = data.version ?? 5
  if (version !== 5 && version !== 10) {
    console.warn(
      `[xdts-parser] 公式仕様で未定義の version です: ${version} (enum [5, 10])`
    )
  }
  const header: { cut: string; scene: string } = {
    cut: String(data.header?.cut ?? '1'),
    scene: String(data.header?.scene ?? '1'),
  }
  const timeTableName: string = firstTable?.name ?? 'タイムライン1'
  const duration: number = firstTable?.duration ?? 72
  // frameRate は公式スキーマ外の CSP 独自拡張フィールド。UI 表示（秒数変換）のみで使用
  const fps: number = firstTable?.frameRate ?? 24

  const tracks: XdtsTrack[] = []

  for (const timeTable of data.timeTables ?? []) {
    // fieldId → トラック名配列のマップを構築
    const headerMap = new Map<number, string[]>()
    for (const h of timeTable.timeTableHeaders ?? []) {
      headerMap.set(h.fieldId, h.names ?? [])
    }

    // fieldId=0（CELL）のフィールドのみ処理
    for (const field of timeTable.fields ?? []) {
      if (field.fieldId !== 0) continue
      const names: string[] = headerMap.get(0) ?? []

      for (const track of field.tracks ?? []) {
        const trackNo: number = track.trackNo ?? 0
        const name: string = names[trackNo] ?? `Track${trackNo}`

        // フレーム処理
        const rawFrames: XdtsFrame[] = []
        for (const frame of track.frames ?? []) {
          const frameIndex: number = frame.frame ?? 0
          const rawValue: string | undefined = frame.data?.[0]?.values?.[0]
          if (rawValue === undefined) continue

          // HYPHEN / TICK_1 / TICK_2 はホールド継続扱いでフレームを追加しない
          if (
            rawValue === SYMBOL_HYPHEN ||
            rawValue === SYMBOL_TICK_1 ||
            rawValue === SYMBOL_TICK_2
          ) {
            continue
          }

          const cellName = rawValue === SYMBOL_NULL_CELL ? null : rawValue
          rawFrames.push({ frameIndex, cellName })
        }

        // frameIndex 昇順ソート（負フレーム含む）
        rawFrames.sort((a, b) => a.frameIndex - b.frameIndex)

        // cellNames: 実際に使用されているユニークなセル名一覧（UI のセル選択用）
        const cellNames: string[] = []
        const seenCells = new Set<string>()
        for (const f of rawFrames) {
          if (f.cellName !== null && !seenCells.has(f.cellName)) {
            seenCells.add(f.cellName)
            cellNames.push(f.cellName)
          }
        }

        tracks.push({ name, trackNo, cellNames, frames: rawFrames })
      }
    }
  }

  return { tracks, version, header, timeTableName, duration, fps }
}

/**
 * 指定フレームにおける各トラックのセル名を解決する（ホールドルール適用）
 *
 * - フレームNまでの割り当てを逆順に走査し、最初に見つかったものを採用
 * - SYMBOL_NULL_CELL（null）が最後の割り当てならそのトラックは何も表示しない
 * - 一度も割り当てがない場合も何も表示しない
 * - 負のフレーム番号が含まれていても動作する（initial value として機能する）
 *
 * 同名トラックが複数ある場合、Map のキーが上書きされるため、アニメフォルダ対応や
 * タイムライン同期の内部処理では resolveCellsAtFrameByTrackNo を使うこと。
 *
 * @returns Map<trackName, cellName | null>  null = 表示なし
 */
export function resolveCellsAtFrame(
  tracks: XdtsTrack[],
  frameIndex: number,
): Map<string, string | null> {
  const result = new Map<string, string | null>()

  for (const track of tracks) {
    // frameIndex以下のフレームを降順に走査して最初に見つかったものを採用
    let resolved: string | null | undefined = undefined
    for (let i = track.frames.length - 1; i >= 0; i--) {
      const f = track.frames[i]
      if (f.frameIndex <= frameIndex) {
        resolved = f.cellName  // null（空コマ）も有効な値として採用
        break
      }
    }
    // 割り当てなし → null（表示しない）
    result.set(track.name, resolved ?? null)
  }

  return result
}

/**
 * 指定フレームにおける各トラックのセル名を trackNo キーで解決する。
 *
 * 同名トラックでは trackName キーの Map が上書きされるため、アニメフォルダ対応や
 * タイムライン同期の内部処理ではこちらを使う。
 */
export function resolveCellsAtFrameByTrackNo(
  tracks: XdtsTrack[],
  frameIndex: number,
): Map<number, string | null> {
  const result = new Map<number, string | null>()

  for (const track of tracks) {
    let resolved: string | null | undefined = undefined
    for (let i = track.frames.length - 1; i >= 0; i--) {
      const f = track.frames[i]
      if (f.frameIndex <= frameIndex) {
        resolved = f.cellName
        break
      }
    }
    result.set(track.trackNo, resolved ?? null)
  }

  return result
}

/**
 * 指定セルがそのトラックで最初に登場するフレームインデックスを返す
 * 見つからない場合は -1
 */
export function findFirstFrameOfCell(track: XdtsTrack, cellName: string): number {
  for (const f of track.frames) {
    if (f.cellName === cellName) return f.frameIndex
  }
  return -1
}
