import type { CspLayer } from '../types'

/**
 * 割当済みアニメフォルダに対する displayName(出力フォルダ名・ファイル名プレフィックスのベース)を計算する。
 *
 * 設計:
 * - トラック↔フォルダの対応は assignTracksToFolders で既に決まっている前提
 * - displayName は「CSP 表示上の name から末尾空白等を落とした、出力で使える形」
 *
 * 出力 namespace / collision family:
 *   - namespace = parentSuffix
 *   - family = trim 後の base 名を case-insensitive に見た値
 *
 *   - raw 名が違っても、出力に使う base 名が同じ family に落ちる場合は
 *     同じ collision family として連番で分離する
 *     例: `A`, `a`, `A ` は同じ family
 *
 *   - **同じ raw 名でも parentSuffix が異なれば別 namespace** (process variants)
 *     例: c001 の `作画/A`(suffix="") と `演出/A`(suffix="_e") は別 namespace、
 *         両方とも displayName "A" で、fileName 側の工程名位置設定で分岐する
 *
 *   - **同じ family に複数候補が居る場合は (n) 連番でユニーク化**
 *     例: `A`, `a`, `A ` (全部 suffix="") → "A", "a(2)", "A(3)"
 *
 *   - 連番付けは family 内で **trackNo 昇順**(= ボトム優先)
 *
 * - literal 衝突回避:
 *   生成した `A(2)` 等が同じ namespace 内の literal base と衝突する場合、
 *   番号を飛ばす (ユーザが literal で "A(2)" と命名しているケース等)
 *
 * 例:
 * - c001 の 3 つの anim folder
 *   - 作画/A (a, "")   → "A"
 *   - 作画/B (b, "")   → "B"
 *   - 演出/A (a, "_e") → "A"   (parentSuffix が違うので別 namespace、連番なし)
 * - yc4 の 3 つの anim folder
 *   - bottom A (a, "") → "A"
 *   - middle A (a, "") → "A(2)"
 *   - top A    (a, "") → "A(3)"  (全部同一 family → 連番)
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

  interface NamespaceMember {
    layer: CspLayer
    trackNo: number
    baseName: string
    familyKey: string
  }

  // parentSuffix(namespace) ごとにメンバを集める
  const namespaceGroups = new Map<string, NamespaceMember[]>()
  for (const [layerId, trackNo] of assignment) {
    const layer = layerById.get(layerId)
    if (!layer) continue
    const baseName = layer.originalName.trim()
    const parentSuffix = parentSuffixByLayerId.get(layerId) ?? ''
    const member: NamespaceMember = {
      layer,
      trackNo,
      baseName,
      familyKey: baseName.toLowerCase(),
    }
    let members = namespaceGroups.get(parentSuffix)
    if (!members) {
      members = []
      namespaceGroups.set(parentSuffix, members)
    }
    members.push(member)
  }

  // namespace ごとに displayName を決定する。
  // 同じ parentSuffix 空間では literal base と自動生成名の衝突を避ける。
  for (const members of namespaceGroups.values()) {
    const literalBaseLowers = new Set(members.map(member => member.baseName.toLowerCase()))
    const usedNames = new Set<string>()
    const families = new Map<string, NamespaceMember[]>()

    for (const member of members) {
      let family = families.get(member.familyKey)
      if (!family) {
        family = []
        families.set(member.familyKey, family)
      }
      family.push(member)
    }

    const orderedFamilies = [...families.values()]
      .map(family => family.sort((a, b) => a.trackNo - b.trackNo))
      .sort((a, b) => a[0].trackNo - b[0].trackNo)

    for (const family of orderedFamilies) {
      for (const member of family) {
        const candidate = allocateDisplayName(member.baseName, literalBaseLowers, usedNames)
        usedNames.add(candidate.toLowerCase())
        displayNames.set(member.layer.id, candidate)
      }
    }
  }

  return displayNames
}

/**
 * 同一 family 内で使う displayName を確保する。
 *
 * base 名そのままが未使用ならそのまま採用する。
 * 使われている場合は `(n)` を付けるが、family 内に literal で `A(2)` のような
 * base 名が存在する場合はそこを避けて次の番号へ進める。
 */
function allocateDisplayName(
  baseName: string,
  literalBaseLowers: Set<string>,
  usedNames: Set<string>,
): string {
  const baseLower = baseName.toLowerCase()
  if (!usedNames.has(baseLower)) return baseName

  let n = 2
  while (true) {
    const candidate = `${baseName}(${n})`
    const lower = candidate.toLowerCase()
    if (!usedNames.has(lower) && !literalBaseLowers.has(lower)) {
      return candidate
    }
    n++
  }
}
