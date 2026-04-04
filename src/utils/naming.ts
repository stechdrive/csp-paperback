/**
 * 出力ファイル名生成・衝突解決ユーティリティ
 */

/**
 * ファイル名衝突時に _2, _3 サフィックスを付与して一意にする
 * 入力配列の順序を保持する
 */
export function resolveNameCollisions(names: string[]): string[] {
  const counts = new Map<string, number>()
  const result: string[] = []

  for (const name of names) {
    const ext = getExtension(name)
    const base = name.slice(0, name.length - ext.length)
    const count = counts.get(name) ?? 0
    counts.set(name, count + 1)

    if (count === 0) {
      result.push(name)
    } else {
      result.push(`${base}_${count + 1}${ext}`)
    }
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
 * アニメセル通常モードのファイル名を生成
 * 例: folderName='A', index=0, digits=4 → 'A_0001'
 */
export function makeAnimCellName(folderName: string, index: number, digits: number): string {
  return `${folderName}_${formatSequenceNumber(index + 1, digits)}`
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
