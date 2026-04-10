import { describe, it, expect, vi } from 'vitest'
import {
  parseXdts,
  resolveCellsAtFrame,
  resolveCellsAtFrameByTrackNo,
  findFirstFrameOfCell,
} from '../../utils/xdts-parser'

/**
 * 実際のxdts形式（ヘッダー行+JSON）のテスト用ヘルパー
 * fieldId=0 が CELL トラック（アニメーションフォルダ対象）
 */
function makeXdtsJson(timeTables: object[]): string {
  const json = JSON.stringify({ version: 5, timeTables, header: { cut: '1', scene: '1' } })
  return `exchangeDigitalTimeSheet Save Data\n${json}`
}

function makeTimeTable(names: string[], frames: Record<number, string[]> = {}) {
  const tracks = names.map((_, trackNo) => {
    const cells = frames[trackNo] ?? ['1']
    return {
      trackNo,
      frames: cells.map((cellName, i) => ({
        frame: i * 10,
        data: [{ id: 0, values: [cellName] }],
      })),
    }
  })
  return {
    name: 'タイムライン1',
    timeTableHeaders: [{ fieldId: 0, names }],
    fields: [{ fieldId: 0, tracks }],
  }
}

describe('parseXdts', () => {
  it('CELLトラック（fieldId=0）を解析する', () => {
    const xdts = makeXdtsJson([makeTimeTable(['A', 'B', 'C'])])
    const result = parseXdts(xdts)
    expect(result.tracks).toHaveLength(3)
    expect(result.tracks.map(t => t.name)).toEqual(['A', 'B', 'C'])
  })

  it('fieldId=0以外のフィールド（カメラワーク等）は無視する', () => {
    const json = JSON.stringify({
      version: 5,
      timeTables: [{
        name: 'タイムライン1',
        timeTableHeaders: [
          { fieldId: 0, names: ['A', 'B'] },
          { fieldId: 5, names: ['CAM'] },
        ],
        fields: [
          { fieldId: 0, tracks: [
            { trackNo: 0, frames: [{ frame: 0, data: [{ id: 0, values: ['1'] }] }] },
            { trackNo: 1, frames: [{ frame: 0, data: [{ id: 0, values: ['1'] }] }] },
          ]},
          { fieldId: 5, tracks: [
            { trackNo: 0, frames: [{ frame: 0, data: [{ id: 0, values: ['zoom'] }] }] },
          ]},
        ],
      }],
      header: { cut: '1', scene: '1' },
    })
    const result = parseXdts(`exchangeDigitalTimeSheet Save Data\n${json}`)
    expect(result.tracks).toHaveLength(2)
    expect(result.tracks.map(t => t.name)).toEqual(['A', 'B'])
  })

  it('SYMBOL_NULL_CELLを除いたセル名を収集する', () => {
    const json = JSON.stringify({
      version: 5,
      timeTables: [{
        name: 'タイムライン1',
        timeTableHeaders: [{ fieldId: 0, names: ['A'] }],
        fields: [{
          fieldId: 0,
          tracks: [{
            trackNo: 0,
            frames: [
              { frame: 0, data: [{ id: 0, values: ['1'] }] },
              { frame: 10, data: [{ id: 0, values: ['2'] }] },
              { frame: 20, data: [{ id: 0, values: ['SYMBOL_NULL_CELL'] }] },
            ],
          }],
        }],
      }],
      header: { cut: '1', scene: '1' },
    })
    const result = parseXdts(`exchangeDigitalTimeSheet Save Data\n${json}`)
    expect(result.tracks[0].cellNames).toEqual(['1', '2'])
  })

  it('同名トラックを全部保持する（trackNo で識別）', () => {
    // 公式仕様では names 配列の重複は禁止されていないため、CSP は同名トラックを
    // エクスポートすることがある（例: 末尾空白サニタイズで "A " "A" "A" が並ぶ等）。
    // 本パーサは dedup せず全部保持し、後段の assignTracksToFolders で対応付ける。
    const xdts = makeXdtsJson([makeTimeTable(['A', 'B', 'A'])])
    const result = parseXdts(xdts)
    expect(result.tracks).toHaveLength(3)
    expect(result.tracks.map(t => t.name)).toEqual(['A', 'B', 'A'])
    expect(result.tracks.map(t => t.trackNo)).toEqual([0, 1, 2])
  })

  it('末尾空白を含む同名トラックもそのまま保持する', () => {
    // 実際の CSP が吐く "A ", "A", "A" のようなケース
    const xdts = makeXdtsJson([makeTimeTable(['A ', 'A', 'A'])])
    const result = parseXdts(xdts)
    expect(result.tracks).toHaveLength(3)
    expect(result.tracks.map(t => t.name)).toEqual(['A ', 'A', 'A'])
    expect(result.tracks.map(t => t.trackNo)).toEqual([0, 1, 2])
  })

  it('SYMBOL_HYPHEN のフレームはドロップされる（ホールドで直前値が継続する）', () => {
    const json = JSON.stringify({
      version: 5,
      timeTables: [{
        name: 'タイムライン1',
        timeTableHeaders: [{ fieldId: 0, names: ['A'] }],
        fields: [{
          fieldId: 0,
          tracks: [{
            trackNo: 0,
            frames: [
              { frame: 0, data: [{ id: 0, values: ['1'] }] },
              { frame: 10, data: [{ id: 0, values: ['SYMBOL_HYPHEN'] }] },
              { frame: 20, data: [{ id: 0, values: ['2'] }] },
            ],
          }],
        }],
      }],
      header: { cut: '1', scene: '1' },
    })
    const result = parseXdts(`exchangeDigitalTimeSheet Save Data\n${json}`)
    expect(result.tracks[0].frames).toHaveLength(2)
    expect(result.tracks[0].frames.map(f => f.frameIndex)).toEqual([0, 20])
    expect(result.tracks[0].cellNames).toEqual(['1', '2'])
  })

  it('SYMBOL_TICK_1 / SYMBOL_TICK_2 のフレームもドロップされる（中割り/逆シート記号はラベル扱い）', () => {
    const json = JSON.stringify({
      version: 5,
      timeTables: [{
        name: 'タイムライン1',
        timeTableHeaders: [{ fieldId: 0, names: ['A'] }],
        fields: [{
          fieldId: 0,
          tracks: [{
            trackNo: 0,
            frames: [
              { frame: 0, data: [{ id: 0, values: ['1'] }] },
              { frame: 5, data: [{ id: 0, values: ['SYMBOL_TICK_1'] }] },
              { frame: 10, data: [{ id: 0, values: ['SYMBOL_TICK_2'] }] },
              { frame: 15, data: [{ id: 0, values: ['2'] }] },
            ],
          }],
        }],
      }],
      header: { cut: '1', scene: '1' },
    })
    const result = parseXdts(`exchangeDigitalTimeSheet Save Data\n${json}`)
    expect(result.tracks[0].frames).toHaveLength(2)
    expect(result.tracks[0].frames.map(f => f.frameIndex)).toEqual([0, 15])
  })

  it('負のフレーム番号は保持される（仕様外だが CSP が吐くケースあり、initial value として機能）', () => {
    const json = JSON.stringify({
      version: 5,
      timeTables: [{
        name: 'タイムライン1',
        timeTableHeaders: [{ fieldId: 0, names: ['A'] }],
        fields: [{
          fieldId: 0,
          tracks: [{
            trackNo: 0,
            frames: [
              { frame: -5, data: [{ id: 0, values: ['X'] }] },
              { frame: 10, data: [{ id: 0, values: ['1'] }] },
            ],
          }],
        }],
      }],
      header: { cut: '1', scene: '1' },
    })
    const result = parseXdts(`exchangeDigitalTimeSheet Save Data\n${json}`)
    // 負フレームも保持されかつ昇順ソートされる
    expect(result.tracks[0].frames).toHaveLength(2)
    expect(result.tracks[0].frames.map(f => f.frameIndex)).toEqual([-5, 10])
    // 負フレームの値はフレーム 0 以降のクエリでも initial value として機能する
    const resolved = resolveCellsAtFrame(result.tracks, 0)
    expect(resolved.get('A')).toBe('X')
  })

  it('frames は frameIndex 昇順にソートされる（入力順不同でも OK）', () => {
    const json = JSON.stringify({
      version: 5,
      timeTables: [{
        name: 'タイムライン1',
        timeTableHeaders: [{ fieldId: 0, names: ['A'] }],
        fields: [{
          fieldId: 0,
          tracks: [{
            trackNo: 0,
            frames: [
              { frame: 20, data: [{ id: 0, values: ['3'] }] },
              { frame: 0, data: [{ id: 0, values: ['1'] }] },
              { frame: 10, data: [{ id: 0, values: ['2'] }] },
            ],
          }],
        }],
      }],
      header: { cut: '1', scene: '1' },
    })
    const result = parseXdts(`exchangeDigitalTimeSheet Save Data\n${json}`)
    expect(result.tracks[0].frames.map(f => f.frameIndex)).toEqual([0, 10, 20])
  })

  it('version 5 を受け入れる', () => {
    const xdts = makeXdtsJson([makeTimeTable(['A'])])  // version: 5 (helper default)
    const result = parseXdts(xdts)
    expect(result.version).toBe(5)
  })

  it('version 10 を受け入れる', () => {
    const json = JSON.stringify({
      version: 10,
      timeTables: [{
        name: 'タイムライン1',
        timeTableHeaders: [{ fieldId: 0, names: ['A'] }],
        fields: [{ fieldId: 0, tracks: [{ trackNo: 0, frames: [{ frame: 0, data: [{ id: 0, values: ['1'] }] }] }] }],
      }],
      header: { cut: '1', scene: '1' },
    })
    const result = parseXdts(`exchangeDigitalTimeSheet Save Data\n${json}`)
    expect(result.version).toBe(10)
    expect(result.tracks).toHaveLength(1)
  })

  it('未知の version でも warn を出してパース成功する', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const json = JSON.stringify({
      version: 99,
      timeTables: [{
        name: 'タイムライン1',
        timeTableHeaders: [{ fieldId: 0, names: ['A'] }],
        fields: [{ fieldId: 0, tracks: [{ trackNo: 0, frames: [{ frame: 0, data: [{ id: 0, values: ['1'] }] }] }] }],
      }],
      header: { cut: '1', scene: '1' },
    })
    const result = parseXdts(`exchangeDigitalTimeSheet Save Data\n${json}`)
    expect(result.version).toBe(99)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('version'))
    warnSpy.mockRestore()
  })

  it('trackNo がフレーム処理に反映される', () => {
    const xdts = makeXdtsJson([makeTimeTable(['A', 'B', 'C'])])
    const result = parseXdts(xdts)
    expect(result.tracks.map(t => t.trackNo)).toEqual([0, 1, 2])
  })

  it('トラックが0件のxdtsは空配列を返す', () => {
    const xdts = makeXdtsJson([])
    const result = parseXdts(xdts)
    expect(result.tracks).toHaveLength(0)
  })

  it('不正なJSONはエラーを投げる', () => {
    expect(() => parseXdts('exchangeDigitalTimeSheet Save Data\n{invalid')).toThrow()
  })

  it('_プレフィックスのトラック名もそのまま解析する', () => {
    const xdts = makeXdtsJson([makeTimeTable(['_BG1', '_BOOK1', 'A'])])
    const result = parseXdts(xdts)
    expect(result.tracks).toHaveLength(3)
    expect(result.tracks[0].name).toBe('_BG1')
  })

  it('framesにフレームインデックスとセル名が格納される', () => {
    const json = JSON.stringify({
      version: 5,
      timeTables: [{
        name: 'タイムライン1',
        timeTableHeaders: [{ fieldId: 0, names: ['A'] }],
        fields: [{
          fieldId: 0,
          tracks: [{
            trackNo: 0,
            frames: [
              { frame: 0, data: [{ id: 0, values: ['A0001'] }] },
              { frame: 8, data: [{ id: 0, values: ['A0002'] }] },
              { frame: 16, data: [{ id: 0, values: ['SYMBOL_NULL_CELL'] }] },
            ],
          }],
        }],
      }],
      header: { cut: '1', scene: '1' },
    })
    const result = parseXdts(`exchangeDigitalTimeSheet Save Data\n${json}`)
    const frames = result.tracks[0].frames
    expect(frames).toHaveLength(3)
    expect(frames[0]).toEqual({ frameIndex: 0, cellName: 'A0001' })
    expect(frames[1]).toEqual({ frameIndex: 8, cellName: 'A0002' })
    expect(frames[2]).toEqual({ frameIndex: 16, cellName: null })  // SYMBOL_NULL_CELL → null
  })
})

describe('resolveCellsAtFrame', () => {
  function makeTrack(name: string, entries: [number, string | null][]) {
    return {
      name,
      trackNo: 0,
      cellNames: entries.flatMap(([, c]) => c ? [c] : []),
      frames: entries.map(([frameIndex, cellName]) => ({ frameIndex, cellName })),
    }
  }

  it('指定フレームのセルをホールドルールで解決する', () => {
    // A: frame0→A0001, frame8→A0002
    // B: frame0→B0001
    const tracks = [
      makeTrack('A', [[0, 'A0001'], [8, 'A0002']]),
      makeTrack('B', [[0, 'B0001']]),
    ]
    // frame10: Aはframe8のA0002（ホールド）、BはB0001（ホールド）
    const result = resolveCellsAtFrame(tracks, 10)
    expect(result.get('A')).toBe('A0002')
    expect(result.get('B')).toBe('B0001')
  })

  it('SYMBOL_NULL_CELL（null）がホールドされる場合は表示なし', () => {
    const tracks = [
      makeTrack('A', [[0, 'A0001'], [16, null]]),
    ]
    const result = resolveCellsAtFrame(tracks, 20)
    expect(result.get('A')).toBeNull()
  })

  it('指定フレームより前に割り当てがない場合はnull', () => {
    const tracks = [
      makeTrack('A', [[10, 'A0001']]),
    ]
    const result = resolveCellsAtFrame(tracks, 5)
    expect(result.get('A')).toBeNull()
  })

  it('ちょうどそのフレームの割り当ては採用される', () => {
    const tracks = [
      makeTrack('A', [[8, 'A0002']]),
    ]
    const result = resolveCellsAtFrame(tracks, 8)
    expect(result.get('A')).toBe('A0002')
  })
})

describe('resolveCellsAtFrameByTrackNo', () => {
  function makeTrack(name: string, trackNo: number, entries: [number, string | null][]) {
    return {
      name,
      trackNo,
      cellNames: entries.flatMap(([, c]) => c ? [c] : []),
      frames: entries.map(([frameIndex, cellName]) => ({ frameIndex, cellName })),
    }
  }

  it('同名トラックを trackNo キーで保持する', () => {
    const tracks = [
      makeTrack('A', 0, [[0, '1']]),
      makeTrack('A', 1, [[0, '2']]),
    ]
    const result = resolveCellsAtFrameByTrackNo(tracks, 0)
    expect(result.get(0)).toBe('1')
    expect(result.get(1)).toBe('2')
  })
})

describe('findFirstFrameOfCell', () => {
  it('セルが最初に登場するフレームインデックスを返す', () => {
    const track = {
      name: 'A',
      trackNo: 0,
      cellNames: ['A0001', 'A0002'],
      frames: [
        { frameIndex: 0, cellName: 'A0001' },
        { frameIndex: 8, cellName: 'A0002' },
        { frameIndex: 16, cellName: 'A0001' },
      ],
    }
    expect(findFirstFrameOfCell(track, 'A0001')).toBe(0)
    expect(findFirstFrameOfCell(track, 'A0002')).toBe(8)
  })

  it('存在しないセル名は-1を返す', () => {
    const track = {
      name: 'A',
      trackNo: 0,
      cellNames: ['A0001'],
      frames: [{ frameIndex: 0, cellName: 'A0001' }],
    }
    expect(findFirstFrameOfCell(track, 'A0099')).toBe(-1)
  })
})
