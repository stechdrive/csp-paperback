import type { CspLayer, XdtsTrack } from '../types'

/**
 * XDTS トラックと PSD ツリー内のアニメフォルダ候補の対応付けを計算する。
 *
 * 背景:
 * - CSP は同名の anim folder をエクスポートすることがある(末尾空白 + 同名等)。
 * - 公式仕様(*6)では trackNo 0 = ボトムレイヤーと決まっている。
 * - `_` プレフィックスは本アプリの単体出力マークであり、XDTS の対応候補を
 *   劣後させる条件ではない。アーカイブ除外は archivePatterns 等の明示ルールで扱う。
 *
 * ルール:
 *
 * 1. 名前の正規化: trim + lowercase。CSP が末尾空白を嫌って "A " のような
 *    バリアントを吐くケースを吸収するため。
 *
 * 2. 候補: 以下を満たすフォルダ
 *    - isFolder
 *    - 正規化名がいずれかのトラック名(正規化済)と一致する
 *    hidden / uiHidden は「出力参加」の状態なので、XDTS 検出フェーズでは見ない。
 *
 * 3. 収集順序: ツリーをボトム優先で post-order (reverse-children) 走査。
 *    結果として candidates[0] が最もボトム、末尾が最もトップになる。
 *
 * 4. 割当: 各トラックを trackNo 昇順(= ボトム優先)に処理し、
 *    同じ正規化名の候補プールからボトム順に取り出して 1:1 割当。
 *    どのプールからも取り出せないトラックは unmatchedTracks に入る。
 *
 * 5. 余剰候補(XDTS にない/XDTS のトラック数に対して余る)は assignment に入らず、
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

  function walk(layers: CspLayer[]): void {
    // 兄弟はボトム優先で走査(CspLayer の children はトップファースト配列なので逆順に)
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]

      if (layer.isFolder) {
        // post-order: 子を先に訪問
        walk(layer.children)

        const trimmed = normalize(layer.originalName)
        if (trackTrimmedNameSet.has(trimmed)) {
          candidates.push({ layer, trimmedName: trimmed })
        }
      }
    }
  }

  walk(tree)
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

  // 正規化名 → ボトム優先候補プールを構築
  const poolsByName = new Map<string, Candidate[]>()
  for (const c of allCandidates) {
    let pool = poolsByName.get(c.trimmedName)
    if (!pool) {
      pool = []
      poolsByName.set(c.trimmedName, pool)
    }
    pool.push(c)
  }

  // 各トラックを trackNo 昇順に処理して割当
  const sortedTracks = [...tracks].sort((a, b) => a.trackNo - b.trackNo)
  for (const track of sortedTracks) {
    const trimmed = normalize(track.name)
    const pool = poolsByName.get(trimmed)
    const picked = pool?.shift()
    if (picked) {
      assignment.set(picked.layer.id, track.trackNo)
    } else {
      unmatchedTracks.push(track)
    }
  }

  return { assignment, unmatchedTracks }
}

/**
 * 検出済みツリーから XDTS assignment を復元する。
 *
 * 出力・プレビュー時に assignTracksToFolders を再実行すると、
 * UI 表示状態を反映したツリー等によって XDTS 対応が揺れる可能性がある。
 * XDTS 対応は読み込み時に確定した構造情報として扱い、この関数で
 * layer.animationFolder.trackNo だけを参照する。
 */
export function buildAssignmentFromDetectedFolders(tree: CspLayer[]): Map<string, number> {
  const assignment = new Map<string, number>()

  function walk(layers: CspLayer[]): void {
    for (const layer of layers) {
      if (
        layer.isAnimationFolder &&
        layer.animationFolder?.detectedBy === 'xdts' &&
        typeof layer.animationFolder.trackNo === 'number'
      ) {
        assignment.set(layer.id, layer.animationFolder.trackNo)
      }
      if (layer.children.length > 0) walk(layer.children)
    }
  }

  walk(tree)
  return assignment
}
