import type { XdtsData, XdtsFrame, XdtsTrack } from '../types'

/**
 * xdtsファイルを解析してXdtsDataを返す
 *
 * xdtsは1行目に "exchangeDigitalTimeSheet Save Data" というテキストヘッダーがあり、
 * 2行目以降がJSON形式。
 *
 * JSON構造:
 *   timeTables[].timeTableHeaders[n].fieldId  → フィールド種別
 *   timeTables[].timeTableHeaders[n].names    → trackNoに対応するトラック名配列
 *   timeTables[].fields[n].fieldId            → フィールド種別（同上）
 *   timeTables[].fields[n].tracks[]
 *     .trackNo   → names配列のインデックス
 *     .frames[].data[0].values[0]  → そのフレームで使用するセル名
 *
 * fieldId の種別（xdtsio.h より）:
 *   0 = CELL      → アニメーションセルのトラック（アニメーションフォルダ対象）
 *   3 = DIALOG    → セリフタイミング
 *   5 = CAMERAWORK → カメラワーク
 *
 * fieldId=0 のトラックのみを対象とする。
 * 名前によるフィルタリング（_プレフィックスやCAM判定）は行わない。
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

  const tracks: XdtsTrack[] = []
  // 同名トラックの重複を防ぐ
  const seenNames = new Set<string>()

  // xdts書き出し用メタデータ（最初のtimeTableを使用）
  const firstTable = data.timeTables?.[0]
  const version: number = data.version ?? 5
  const header: { cut: string; scene: string } = {
    cut: String(data.header?.cut ?? '1'),
    scene: String(data.header?.scene ?? '1'),
  }
  const timeTableName: string = firstTable?.name ?? 'タイムライン1'
  const duration: number = firstTable?.duration ?? 72
  const fps: number = firstTable?.frameRate ?? 24

  for (const timeTable of data.timeTables ?? []) {
    // fieldId → トラック名配列のマップを構築
    const headerMap = new Map<number, string[]>()
    for (const header of timeTable.timeTableHeaders ?? []) {
      headerMap.set(header.fieldId, header.names ?? [])
    }

    // fieldId=0（CELL）のフィールドのみ処理
    for (const field of timeTable.fields ?? []) {
      if (field.fieldId !== 0) continue

      const names: string[] = headerMap.get(0) ?? []

      for (const track of field.tracks ?? []) {
        const trackNo: number = track.trackNo ?? 0
        const name: string = names[trackNo] ?? `Track${trackNo}`

        if (seenNames.has(name)) continue
        seenNames.add(name)

        // フレームデータ収集 + ユニークセル名一覧
        const cellNames: string[] = []
        const seenCells = new Set<string>()
        const frames: XdtsFrame[] = []

        for (const frame of track.frames ?? []) {
          const frameIndex: number = frame.frame ?? 0
          const cellName: string | undefined = frame.data?.[0]?.values?.[0]
          const resolvedName = (cellName && cellName !== 'SYMBOL_NULL_CELL') ? cellName : null

          frames.push({ frameIndex, cellName: resolvedName })

          if (resolvedName && !seenCells.has(resolvedName)) {
            seenCells.add(resolvedName)
            cellNames.push(resolvedName)
          }
        }

        tracks.push({ name, cellNames, frames })
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
