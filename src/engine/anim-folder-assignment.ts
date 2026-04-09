import type { CspLayer, XdtsTrack } from '../types'

/**
 * XDTS トラックと PSD ツリー内のアニメフォルダ候補の対応付けを計算する。
 *
 * 背景:
 * - CSP は同名の anim folder をエクスポートすることがある(末尾空白 + 同名等)。
 * - 公式仕様(*6)では trackNo 0 = ボトムレイヤーと決まっている。
 * - `_` プレフィックスのアーカイブフォルダ配下にたまたま名前が一致するフォルダが
 *   あるとき、それを anim folder 扱いするのは原則として避けたいが、
 *   本番ツリー側の候補が足りない場合は fallback で使いたい。
 *
 * ルール:
 *
 * 1. 名前の正規化: trim + lowercase。CSP が末尾空白を嫌って "A " のような
 *    バリアントを吐くケースを吸収するため。
 *
 * 2. 候補: 以下を満たすフォルダ
 *    - isFolder
 *    - hidden / uiHidden でない
 *    - 自身が autoMarked / singleMark でない(= 単体マーク出力対象ではない)
 *    - 正規化名がいずれかのトラック名(正規化済)と一致する
 *
 * 3. 候補の優先度
 *    - 優先 1: 祖先チェーンに autoMarked/singleMark が 1 つもない(本番ツリー側)
 *    - 優先 2: 祖先チェーンに autoMarked/singleMark がある(アーカイブ配下、fallback)
 *
 * 4. 収集順序: ツリーをボトム優先で post-order (reverse-children) 走査。
 *    結果として candidates[0] が最もボトム、末尾が最もトップになる。
 *
 * 5. 割当: 各トラックを trackNo 昇順(= ボトム優先)に処理し、
 *    同じ正規化名の候補プールから 優先 1 → 優先 2 の順で取り出して 1:1 割当。
 *    どのプールからも取り出せないトラックは unmatchedTracks に入る。
 *
 * 6. 余剰候補(XDTS にない/XDTS のトラック数に対して余る)は assignment に入らず、
 *    結果として anim folder 扱いされない(= 通常フォルダのまま)。
 *    余剰候補は警告対象ではない(XDTS 側からのみ不一致を見る)。
 */

export interface AssignResult {
  /** layerId → trackNo (割当成功した対応のみ) */
  assignment: Map<string, number>
  /** 対応フォルダが見つからなかったトラック(警告表示用) */
  unmatchedTracks: XdtsTrack[]
}

interface Candidate {
  layer: CspLayer
  /** 正規化済みの名前(trim + lowercase) */
  trimmedName: string
  /** 祖先に autoMarked/singleMark があるか */
  hasMarkedAncestor: boolean
}

/** トラック名とフォルダ名を揃えるための正規化 */
function normalize(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * ツリー内の候補フォルダをボトム優先 (post-order / reverse-children) で収集する
 */
function collectCandidates(
  tree: CspLayer[],
  trackTrimmedNameSet: Set<string>,
): Candidate[] {
  const candidates: Candidate[] = []

  function walk(layers: CspLayer[], ancestorHasMark: boolean): void {
    // 兄弟はボトム優先で走査(CspLayer の children はトップファースト配列なので逆順に)
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]
      if (layer.hidden || layer.uiHidden) continue

      const nextAncestor = ancestorHasMark || layer.autoMarked || layer.singleMark

      if (layer.isFolder) {
        // post-order: 子を先に訪問
        walk(layer.children, nextAncestor)

        // 自身が autoMarked/singleMark なら候補にしない(単体マーク優先)
        if (!layer.autoMarked && !layer.singleMark) {
          const trimmed = normalize(layer.originalName)
          if (trackTrimmedNameSet.has(trimmed)) {
            candidates.push({
              layer,
              trimmedName: trimmed,
              hasMarkedAncestor: ancestorHasMark,
            })
          }
        }
      }
    }
  }

  walk(tree, false)
  return candidates
}

export function assignTracksToFolders(
  tree: CspLayer[],
  tracks: XdtsTrack[],
): AssignResult {
  const assignment = new Map<string, number>()
  const unmatchedTracks: XdtsTrack[] = []

  if (tracks.length === 0) return { assignment, unmatchedTracks }

  // トラック正規化名のセット(候補収集時のフィルタに使用)
  const trackTrimmedNameSet = new Set(tracks.map(t => normalize(t.name)))

  // 候補をボトム優先で収集
  const allCandidates = collectCandidates(tree, trackTrimmedNameSet)

  // 正規化名 → {優先1, 優先2} のプールを構築
  const poolsByName = new Map<string, { prio1: Candidate[]; prio2: Candidate[] }>()
  for (const c of allCandidates) {
    let pool = poolsByName.get(c.trimmedName)
    if (!pool) {
      pool = { prio1: [], prio2: [] }
      poolsByName.set(c.trimmedName, pool)
    }
    if (c.hasMarkedAncestor) pool.prio2.push(c)
    else pool.prio1.push(c)
  }

  // 各トラックを trackNo 昇順に処理して割当
  const sortedTracks = [...tracks].sort((a, b) => a.trackNo - b.trackNo)
  for (const track of sortedTracks) {
    const trimmed = normalize(track.name)
    const pool = poolsByName.get(trimmed)
    // 優先 1 → 優先 2 の順で取り出す
    const picked = pool?.prio1.shift() ?? pool?.prio2.shift()
    if (picked) {
      assignment.set(picked.layer.id, track.trackNo)
    } else {
      unmatchedTracks.push(track)
    }
  }

  return { assignment, unmatchedTracks }
}
