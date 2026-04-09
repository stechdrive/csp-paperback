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
 * 同名トラックが複数ある場合、Map のキーが上書きされるため、**呼び出し側は
 * 同名問題を考慮して assignTracksToFolders 等の対応層を使うこと**。
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
 * 指定セルがそのトラックで最初に登場するフレームインデックスを返す
 * 見つからない場合は -1
 */
export function findFirstFrameOfCell(track: XdtsTrack, cellName: string): number {
  for (const f of track.frames) {
    if (f.cellName === cellName) return f.frameIndex
  }
  return -1
}

/**
 * XdtsData と追加トラック名リストからxdtsテキストを生成する
 *
 * extraTrackNames: 既存トラックに存在しない名前のみ追加される。
 * 追加トラックは「frame 0 にセル名 "1"、frame duration に SYMBOL_NULL_CELL」
 * という最小限の1コマ構成で生成する。
 *
 * 既存xdtsがない場合はデフォルト値を使用してゼロから生成する。
 *
 * 注意: この関数は現時点で UI から呼び出されない（#1 対応で下流の downloadXdts UI を
 * 非表示化したため）。ロジックは保持しているが、同名トラックや trackNo の保持などは
 * 厳密には見直しされていない。
 */
export function serializeXdts(
  base: XdtsData | null,
  extraTrackNames: string[],
): string {
  const version = base?.version ?? 5
  const header = base?.header ?? { cut: '1', scene: '1' }
  const timeTableName = base?.timeTableName ?? 'タイムライン1'
  const duration = base?.duration ?? 72
  const existingTracks = base?.tracks ?? []

  const existingNames = new Set(existingTracks.map(t => t.name))
  const newNames = extraTrackNames.filter(n => !existingNames.has(n))

  const allNames = [...existingTracks.map(t => t.name), ...newNames]

  // 既存トラックをJSONトラック形式に変換
  const serializedExisting = existingTracks.map((track, i) => ({
    trackNo: i,
    frames: track.frames.map(f => ({
      frame: f.frameIndex,
      data: [{ id: 0, values: [f.cellName ?? 'SYMBOL_NULL_CELL'] }],
    })),
  }))

  // 追加トラック: frame 0 にセル "1"、frame duration に SYMBOL_NULL_CELL
  const serializedNew = newNames.map((_, j) => ({
    trackNo: existingTracks.length + j,
    frames: [
      { frame: 0, data: [{ id: 0, values: ['1'] }] },
      { frame: duration, data: [{ id: 0, values: ['SYMBOL_NULL_CELL'] }] },
    ],
  }))

  const json = {
    timeTables: [{
      duration,
      name: timeTableName,
      timeTableHeaders: [{ fieldId: 0, names: allNames }],
      fields: [{ fieldId: 0, tracks: [...serializedExisting, ...serializedNew] }],
    }],
    version,
    header,
  }

  return `exchangeDigitalTimeSheet Save Data\n${JSON.stringify(json)}`
}
