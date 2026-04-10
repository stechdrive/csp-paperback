import type { CspLayer } from '../types'

/**
 * 割当済みアニメフォルダに対する displayName(出力フォルダ名・ファイル名プレフィックスのベース)を計算する。
 *
 * 設計:
 * - トラック↔フォルダの対応は assignTracksToFolders で既に決まっている前提
 * - displayName は「CSP 表示上の name から末尾空白等を落とした、出力で使える形」
 *
 * Identity ベースのグルーピング:
 *   anim folder の identity = (trim+lowercase name, parentSuffix)
 *
 *   - **同じ name でも parentSuffix が異なれば別 identity** (process variants)
 *     例: c001 の `作画/A`(suffix="") と `演出/A`(suffix="_e") は別 identity、
 *         両方とも displayName "A" で、fileName 側の工程名位置設定で分岐する
 *
 *   - **同じ identity に複数候補が居る場合のみ (n) 連番でユニーク化** (true duplicates)
 *     例: yc4 の 3 つの LO/TEST/A (全部 parentSuffix="") は同一 identity → "A", "A(2)", "A(3)"
 *
 *   - 連番付けは identity 内で **trackNo 昇順**(= ボトム優先)
 *
 * - literal 衝突回避: 生成した `A(2)` 等が他 identity グループの base と衝突する場合、
 *   番号を飛ばす (ユーザが literal で "A(2)" と命名しているケース等)
 *
 * 例:
 * - c001 の 3 つの anim folder
 *   - 作画/A (a, "")   → "A"
 *   - 作画/B (b, "")   → "B"
 *   - 演出/A (a, "_e") → "A"   (parentSuffix が違うので別 identity、連番なし)
 * - yc4 の 3 つの anim folder
 *   - bottom A (a, "") → "A"
 *   - middle A (a, "") → "A(2)"
 *   - top A    (a, "") → "A(3)"  (全部同一 identity → 連番)
 *
 * 注: リターンは「assignment に含まれる layerId 全員分」の displayName。
 *    assignment に含まれない(= anim folder 化されない)候補は入らない。
 */
export function computeDisplayNames(
  tree: CspLayer[],
  assignment: Map<string, number>,  // layerId → trackNo
  parentSuffixByLayerId: Map<string, string>,  // layerId → parentSuffix (processTable 由来)
): Map<string, string> {  // layerId → displayName
  const displayNames = new Map<string, string>()
  if (assignment.size === 0) return displayNames

  // layerId → CspLayer のインデックスを作る
  const layerById = new Map<string, CspLayer>()
  function indexLayers(layers: CspLayer[]): void {
    for (const l of layers) {
      layerById.set(l.id, l)
      if (l.children.length > 0) indexLayers(l.children)
    }
  }
  indexLayers(tree)

  /**
   * Identity キー: trim+lowercase name と parentSuffix を `\x00` で連結した文字列。
   * case-preserved の base 名前は別途 baseByIdentity に保存する。
   */
  function makeIdentityKey(trimmedLowerName: string, parentSuffix: string): string {
    return `${trimmedLowerName}\x00${parentSuffix}`
  }

  // identity ごとに {layer, trackNo} を集める
  const groups = new Map<string, { layer: CspLayer; trackNo: number }[]>()
  for (const [layerId, trackNo] of assignment) {
    const layer = layerById.get(layerId)
    if (!layer) continue
    const trimmedLower = layer.originalName.trim().toLowerCase()
    const parentSuffix = parentSuffixByLayerId.get(layerId) ?? ''
    const key = makeIdentityKey(trimmedLower, parentSuffix)
    let group = groups.get(key)
    if (!group) {
      group = []
      groups.set(key, group)
    }
    group.push({ layer, trackNo })
  }

  // 各グループ内を trackNo 昇順にソート(= ボトム優先)
  for (const group of groups.values()) {
    group.sort((a, b) => a.trackNo - b.trackNo)
  }

  /**
   * 各 identity の base 名(case 保持、trim 済み)を計算。
   * 同一 identity に複数候補がある場合は最初のメンバ(trackNo が一番小さい)の名前を使う。
   *
   * 衝突判定(literal 予約)用: identity の base 名を lowercase で集めた Set。
   * これは「他 identity グループの base と衝突するか」の判定に使う。
   */
  const baseByIdentity = new Map<string, string>()
  const reservedBaseLowers = new Set<string>()
  for (const [key, group] of groups) {
    const base = group[0].layer.originalName.trim()
    baseByIdentity.set(key, base)
    reservedBaseLowers.add(base.toLowerCase())
  }

  // 各 identity グループ内で displayName を決定
  for (const [key, group] of groups) {
    const base = baseByIdentity.get(key)!

    // 先頭メンバは base そのまま(単独 identity ならこれで確定、衝突もしない)
    displayNames.set(group[0].layer.id, base)

    // 2 番目以降(= 同一 identity の true duplicate)のみ (n) 連番で disambiguate
    let n = 2
    for (let i = 1; i < group.length; i++) {
      while (isNameTaken(`${base}(${n})`, reservedBaseLowers, displayNames)) {
        n++
      }
      const candidate = `${base}(${n})`
      displayNames.set(group[i].layer.id, candidate)
      n++
    }
  }

  return displayNames
}

/**
 * `candidate` という displayName が既に使われているかどうかを判定する。
 * - 他 identity グループの base と case-insensitive に衝突するか
 * - 既に生成された displayName と case-insensitive に衝突するか
 *
 * Windows 等の case-insensitive FS でパス衝突が起きないよう常に lowercase で比較する。
 */
function isNameTaken(
  candidate: string,
  reservedBaseLowers: Set<string>,
  displayNames: Map<string, string>,
): boolean {
  const lower = candidate.toLowerCase()
  if (reservedBaseLowers.has(lower)) return true
  for (const existing of displayNames.values()) {
    if (existing.toLowerCase() === lower) return true
  }
  return false
}
