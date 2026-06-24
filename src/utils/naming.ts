/**
 * 出力ファイル名生成・衝突解決ユーティリティ
 */
import type { CellNamingMode } from '../types'

export const MIN_SEQUENCE_DIGITS = 2
export const MAX_SEQUENCE_DIGITS = 4
export const FIXED_SEQUENCE_DIGITS = 4

/**
 * ファイル名衝突時に _2, _3 サフィックスを付与して一意にする
 * Windows/macOS の一般的なファイルシステムでの展開を考慮し、大文字小文字は区別しない
 * 入力配列の順序を保持する
 */
export function resolveNameCollisions(names: string[]): string[] {
  const nextIndexes = new Map<string, number>()
  const used = new Set<string>()
  const result: string[] = []

  for (const name of names) {
    const key = name.toLowerCase()
    const ext = getExtension(name)
    const base = name.slice(0, name.length - ext.length)
    let candidate = name
    let nextIndex = nextIndexes.get(key) ?? 1

    while (used.has(candidate.toLowerCase())) {
      nextIndex += 1
      candidate = `${base}_${nextIndex}${ext}`
    }

    nextIndexes.set(key, nextIndex)
    used.add(candidate.toLowerCase())
    result.push(candidate)
  }

  return result
}

/**
 * ファイル名から拡張子を取得（ドット含む、例: '.jpg'）
 */
function getExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.')
  return dotIndex >= 0 ? name.slice(dotIndex) : ''
}

/**
 * 連番を指定桁数でゼロパディングした文字列を返す
 */
export function formatSequenceNumber(n: number, digits: number): string {
  return String(n).padStart(digits, '0')
}

/**
 * セル枚数に応じた連番桁数を返す。
 * 最低2桁、通常運用の上限は4桁。4桁を超える番号自体は切り捨てない。
 */
export function getSequenceDigitsForCellCount(cellCount: number): number {
  const normalizedCount = Number.isFinite(cellCount)
    ? Math.max(1, Math.floor(cellCount))
    : 1
  return Math.min(
    MAX_SEQUENCE_DIGITS,
    Math.max(MIN_SEQUENCE_DIGITS, String(normalizedCount).length),
  )
}

/**
 * アニメセル通常モードのファイル名を生成
 * 例: folderName='A', index=0, digits=4 → 'A_0001'
 */
export function makeAnimCellName(folderName: string, index: number, digits: number): string {
  return `${folderName}_${formatSequenceNumber(index + 1, digits)}`
}

/**
 * アニメセル名部分を命名モードに応じて生成する。
 * sequenceNumber は 1 始まり。
 */
export function makeCellLabel(
  mode: CellNamingMode,
  cellName: string,
  sequenceNumber: number,
  digits = MIN_SEQUENCE_DIGITS,
): string {
  const sequence = formatSequenceNumber(sequenceNumber, digits)
  switch (mode) {
    case 'sequence':
      return formatSequenceNumber(sequenceNumber, FIXED_SEQUENCE_DIGITS)
    case 'sequence-cellname':
      return `${sequence}_${cellName}`
    case 'cellname':
      return cellName
  }
}

/**
 * 先頭の _ を除去した表示名を返す
 */
export function stripLeadingUnderscore(name: string): string {
  return name.startsWith('_') ? name.slice(1) : name
}

/**
 * OutputEntryのpath一覧から衝突解決を適用して新しいpath一覧を返す
 * 階層保持モード（path）とフラット展開モード（flatName）両方に対応
 */
export function resolveEntryNames(
  entries: { path: string; flatName: string }[]
): { path: string; flatName: string }[] {
  const resolvedPaths = resolveNameCollisions(entries.map(e => e.path))
  const resolvedFlats = resolveNameCollisions(entries.map(e => e.flatName))

  return entries.map((e, i) => ({
    ...e,
    path: resolvedPaths[i],
    flatName: resolvedFlats[i],
  }))
}
