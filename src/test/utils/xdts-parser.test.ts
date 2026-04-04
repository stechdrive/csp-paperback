import { describe, it, expect } from 'vitest'
import { parseXdts, resolveCellsAtFrame, findFirstFrameOfCell } from '../../utils/xdts-parser'

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

  it('同名トラックは重複しない', () => {
    const xdts = makeXdtsJson([makeTimeTable(['A', 'B', 'A'])])
    const result = parseXdts(xdts)
    expect(result.tracks.map(t => t.name)).toEqual(['A', 'B'])
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

describe('findFirstFrameOfCell', () => {
  it('セルが最初に登場するフレームインデックスを返す', () => {
    const track = {
      name: 'A',
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
      cellNames: ['A0001'],
      frames: [{ frameIndex: 0, cellName: 'A0001' }],
    }
    expect(findFirstFrameOfCell(track, 'A0099')).toBe(-1)
  })
})
