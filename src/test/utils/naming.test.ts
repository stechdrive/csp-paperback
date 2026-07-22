import { describe, it, expect } from 'vitest'
import {
  resolveNameCollisions,
  formatSequenceNumber,
  isSequenceNamingMode,
  makeCellFileName,
  makeCellLabel,
  getSequenceDigitsForCellCount,
  resolveAnimationSequenceSeparator,
  resolveSequenceDigits,
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

describe('getSequenceDigitsForCellCount', () => {
  it('99枚までは最低2桁を返す', () => {
    expect(getSequenceDigitsForCellCount(1)).toBe(2)
    expect(getSequenceDigitsForCellCount(99)).toBe(2)
  })

  it('100枚以上は必要桁数を4桁まで返す', () => {
    expect(getSequenceDigitsForCellCount(100)).toBe(3)
    expect(getSequenceDigitsForCellCount(999)).toBe(3)
    expect(getSequenceDigitsForCellCount(1000)).toBe(4)
    expect(getSequenceDigitsForCellCount(9999)).toBe(4)
    expect(getSequenceDigitsForCellCount(10000)).toBe(4)
  })
})

describe('resolveSequenceDigits', () => {
  it('自動では最大連番に合わせる', () => {
    expect(resolveSequenceDigits('auto', 1)).toBe(2)
    expect(resolveSequenceDigits('auto', 100)).toBe(3)
  })

  it('4桁固定では最大連番にかかわらず4桁を返す', () => {
    expect(resolveSequenceDigits('fixed-4', 1)).toBe(4)
    expect(resolveSequenceDigits('fixed-4', 100)).toBe(4)
  })
})

describe('makeCellLabel', () => {
  it('連番モードではゼロ埋め連番を返す', () => {
    expect(makeCellLabel('sequence', 'ア', 1, 2)).toBe('01')
  })

  it('連番セル名モードでは連番の後ろにセル名を付加する', () => {
    expect(makeCellLabel('sequence-cellname', 'ア', 12, 2)).toBe('12_ア')
  })

  it('指定された桁数を反映する', () => {
    expect(makeCellLabel('sequence-cellname', 'ア', 12, 4)).toBe('0012_ア')
  })

  it('連番モードにも指定された桁数を反映する', () => {
    expect(makeCellLabel('sequence', 'ア', 1, 2)).toBe('01')
    expect(makeCellLabel('sequence', 'ア', 12, 3)).toBe('012')
  })

  it('セル名モードではセル名をそのまま返す', () => {
    expect(makeCellLabel('cellname', 'ア', 1, 2)).toBe('ア')
  })
})

describe('resolveAnimationSequenceSeparator', () => {
  it('連番系モードでは区切り設定を反映する', () => {
    expect(resolveAnimationSequenceSeparator('sequence', 'underscore')).toBe('_')
    expect(resolveAnimationSequenceSeparator('sequence-cellname', 'none')).toBe('')
    expect(resolveAnimationSequenceSeparator('sheet-sequence', 'none')).toBe('')
  })

  it('セル名モードでは常にアンダースコアを使う', () => {
    expect(isSequenceNamingMode('cellname')).toBe(false)
    expect(resolveAnimationSequenceSeparator('cellname', 'none')).toBe('_')
  })
})

describe('makeCellFileName', () => {
  it('工程名が後ろの場合に区切りの有無を反映する', () => {
    expect(makeCellFileName({
      trackName: 'A', cellLabel: '01', processSuffix: '_e', trackCellSeparator: '_',
    })).toBe('A_01_e.jpg')
    expect(makeCellFileName({
      trackName: 'A', cellLabel: '01', processSuffix: '_e', trackCellSeparator: '',
    })).toBe('A01_e.jpg')
  })

  it('工程名が前の場合に区切りの有無を反映する', () => {
    expect(makeCellFileName({
      trackName: 'A', cellLabel: '01', processSuffix: '_e',
      processSuffixPosition: 'before-cell', trackCellSeparator: '_',
    })).toBe('A_e_01.jpg')
    expect(makeCellFileName({
      trackName: 'A', cellLabel: '01', processSuffix: '_e',
      processSuffixPosition: 'before-cell', trackCellSeparator: '',
    })).toBe('A_e01.jpg')
  })

  it('セル名末尾と工程サフィックスが完全一致する場合だけ重複付加を抑止する', () => {
    expect(makeCellFileName({
      trackName: 'B', cellLabel: 'B1_e', processSuffix: '_e',
      suppressDuplicateProcessSuffix: true,
    })).toBe('B_B1_e.jpg')
    expect(makeCellFileName({
      trackName: 'B', cellLabel: 'B1_e2', processSuffix: '_e',
      suppressDuplicateProcessSuffix: true,
    })).toBe('B_B1_e2_e.jpg')
    expect(makeCellFileName({
      trackName: 'B', cellLabel: 'B1_E', processSuffix: '_e',
      suppressDuplicateProcessSuffix: true,
    })).toBe('B_B1_E_e.jpg')
  })

  it('工程名を前にしてもセル名に同一サフィックスがあれば重複させない', () => {
    expect(makeCellFileName({
      trackName: 'B', cellLabel: 'B1_e', processSuffix: '_e',
      processSuffixPosition: 'before-cell', suppressDuplicateProcessSuffix: true,
    })).toBe('B_B1_e.jpg')
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
