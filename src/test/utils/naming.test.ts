import { describe, it, expect } from 'vitest'
import {
  resolveNameCollisions,
  formatSequenceNumber,
  makeAnimCellName,
  stripLeadingUnderscore,
  resolveEntryNames,
} from '../../utils/naming'

describe('resolveNameCollisions', () => {
  it('衝突なしはそのまま返す', () => {
    const names = ['A.jpg', 'B.jpg', 'C.jpg']
    expect(resolveNameCollisions(names)).toEqual(['A.jpg', 'B.jpg', 'C.jpg'])
  })

  it('同名が2つある場合は2つ目に_2を付与する', () => {
    const names = ['A.jpg', 'A.jpg']
    expect(resolveNameCollisions(names)).toEqual(['A.jpg', 'A_2.jpg'])
  })

  it('同名が3つある場合は_2, _3を付与する', () => {
    const names = ['A.jpg', 'A.jpg', 'A.jpg']
    expect(resolveNameCollisions(names)).toEqual(['A.jpg', 'A_2.jpg', 'A_3.jpg'])
  })

  it('異なるファイル名が混在する場合に正しく処理する', () => {
    const names = ['A.jpg', 'B.jpg', 'A.jpg', 'C.jpg', 'B.jpg']
    expect(resolveNameCollisions(names)).toEqual(['A.jpg', 'B.jpg', 'A_2.jpg', 'C.jpg', 'B_2.jpg'])
  })

  it('大文字小文字違いも衝突として扱う', () => {
    const names = ['A.jpg', 'a.jpg']
    expect(resolveNameCollisions(names)).toEqual(['A.jpg', 'a_2.jpg'])
  })

  it('自動付与した _2 が既存名と衝突する場合は次の番号へ進める', () => {
    const names = ['A.jpg', 'A_2.jpg', 'A.jpg']
    expect(resolveNameCollisions(names)).toEqual(['A.jpg', 'A_2.jpg', 'A_3.jpg'])
  })

  it('拡張子なしでも動作する', () => {
    const names = ['file', 'file']
    expect(resolveNameCollisions(names)).toEqual(['file', 'file_2'])
  })

  it('空配列は空配列を返す', () => {
    expect(resolveNameCollisions([])).toEqual([])
  })
})

describe('formatSequenceNumber', () => {
  it('4桁ゼロパディング', () => {
    expect(formatSequenceNumber(1, 4)).toBe('0001')
    expect(formatSequenceNumber(42, 4)).toBe('0042')
    expect(formatSequenceNumber(1000, 4)).toBe('1000')
  })

  it('3桁ゼロパディング', () => {
    expect(formatSequenceNumber(1, 3)).toBe('001')
    expect(formatSequenceNumber(999, 3)).toBe('999')
  })

  it('桁数を超える場合はそのまま返す', () => {
    expect(formatSequenceNumber(10000, 4)).toBe('10000')
  })
})

describe('makeAnimCellName', () => {
  it('フォルダ名_連番を生成する', () => {
    expect(makeAnimCellName('A', 0, 4)).toBe('A_0001')
    expect(makeAnimCellName('A', 1, 4)).toBe('A_0002')
    expect(makeAnimCellName('B', 9, 4)).toBe('B_0010')
  })

  it('桁数設定を反映する', () => {
    expect(makeAnimCellName('A', 0, 3)).toBe('A_001')
  })
})

describe('stripLeadingUnderscore', () => {
  it('先頭の_を除去する', () => {
    expect(stripLeadingUnderscore('_撮影指示')).toBe('撮影指示')
  })

  it('_がない場合はそのまま返す', () => {
    expect(stripLeadingUnderscore('背景')).toBe('背景')
  })

  it('先頭の_のみ除去（2つ目以降は残す）', () => {
    expect(stripLeadingUnderscore('_a_b')).toBe('a_b')
  })
})

describe('resolveEntryNames', () => {
  it('pathとflatName両方の衝突を解決する', () => {
    const entries = [
      { path: 'A/cell.jpg', flatName: 'cell.jpg' },
      { path: 'B/cell.jpg', flatName: 'cell.jpg' },
    ]
    const resolved = resolveEntryNames(entries)
    expect(resolved[0].path).toBe('A/cell.jpg')
    expect(resolved[1].path).toBe('B/cell.jpg') // pathは異なるので衝突なし
    expect(resolved[0].flatName).toBe('cell.jpg')
    expect(resolved[1].flatName).toBe('cell_2.jpg') // flatNameは衝突
  })

  it('衝突なしはそのまま返す', () => {
    const entries = [
      { path: 'A/a.jpg', flatName: 'a.jpg' },
      { path: 'B/b.jpg', flatName: 'b.jpg' },
    ]
    const resolved = resolveEntryNames(entries)
    expect(resolved[0]).toEqual(entries[0])
    expect(resolved[1]).toEqual(entries[1])
  })
})
