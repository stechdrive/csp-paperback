import type { CspLayer, XdtsTrack } from '../types'

/**
 * XDTS トラックと PSD ツリー内のアニメフォルダ候補の対応付けを計算する。
 *
 * 背景:
 * - CSP は track 名を raw のまま XDTS に書き出す（大文字小文字・末尾空白を保持する）
 *   ケースがある。
 * - 同名の anim folder をエクスポートすることがある。
 * - 公式仕様(*6)では trackNo 0 = ボトムレイヤーと決まっている。
 * - `_` プレフィックスは本アプリの単体出力マークであり、XDTS の対応候補を
 *   劣後させる条件ではない。アーカイブ除外は archivePatterns 等の明示ルールで扱う。
 *
 * ルール:
 *
 * 1. 名前照合: raw の完全一致。
 *    - `AB` と `ab` は別トラックとして扱う
 *    - `ab` と `ab ` も別トラックとして扱う
 *    - 今のところ trim/case-fold の救済は入れない
 *
 * 2. 候補: 以下を満たすフォルダ
 *    - isFolder
 *    - raw 名がいずれかのトラック名と一致する
 *    hidden / uiHidden で候補からは除外しない。
 *    ただし hidden は「CSP 側で XDTS に書き出されるか」の情報として有用なので、
 *    同名候補プールに祖先込みで実効可視な候補が 1 つでもあれば、
 *    まずその可視候補だけで割当する。hidden 候補は可視候補が尽きたときの
 *    フォールバックとして残す。
 *    uiHidden はアプリ内表示状態なので XDTS 対応付けには使わない。
 *
 * 3. 収集順序: ツリーをボトム優先で post-order (reverse-children) 走査。
 *    結果として候補プール内の先頭が最もボトム、末尾が最もトップになる。
 *
 * 4. 割当: 各トラックを trackNo 昇順(= ボトム優先)に処理し、
 *    同じ raw 名の候補プールから以下の順に 1:1 割当する。
 *    - 祖先込みで hidden ではない実効可視候補が居れば、その可視候補だけを対象にする
 *    - 可視候補が居なければ hidden 候補を含む残りプール全体を対象にする
 *    対象になったプール内では以下の優先順位で 1:1 割当する。
 *    - 直下の子名が track.cellNames と何種類一致するか
 *    - track.frames に現れるセル名が直下の子名で何回説明できるか
 *    - 完全同点なら既存どおりボトム優先
 *    これにより、親の anim folder と同名セルフォルダが共存する場合でも、
 *    XDTS のセル集合をよりよく説明できるフォルダを優先できる。
 *    また、同名候補が「表示中の工程」と「非表示にした元工程」に分かれる現場運用でも、
 *    XDTS 書き出し状態に近い方を自然に優先できる。
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
  /** raw 名（大文字小文字・末尾空白を保持） */
  rawName: string
  /** 直下の子名（hidden を含む）を raw のまま重複排除した集合 */
  directChildNameSet: Set<string>
  /** PSD 上で祖先込みに visible かどうか。uiHidden は含めない。 */
  effectivelyVisible: boolean
}

/**
 * ツリー内の候補フォルダをボトム優先 (post-order / reverse-children) で収集する
 */
function collectCandidates(
  tree: CspLayer[],
  trackNameSet: Set<string>,
): Candidate[] {
  const candidates: Candidate[] = []

  function walk(layers: CspLayer[], ancestorsVisible: boolean): void {
    // 兄弟はボトム優先で走査(CspLayer の children はトップファースト配列なので逆順に)
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]
      const effectivelyVisible = ancestorsVisible && !layer.hidden

      if (layer.isFolder) {
        // post-order: 子を先に訪問
        walk(layer.children, effectivelyVisible)

        const rawName = layer.originalName
        if (trackNameSet.has(rawName)) {
          candidates.push({
            layer,
            rawName,
            directChildNameSet: new Set(layer.children.map(child => child.originalName)),
            effectivelyVisible,
          })
        }
      }
    }
  }

  walk(tree, true)
  return candidates
}

function countDirectChildCellNameMatches(candidate: Candidate, track: XdtsTrack): number {
  const trackCellNames = new Set(track.cellNames)
  if (trackCellNames.size === 0) return 0

  let matches = 0
  for (const cellName of trackCellNames) {
    if (candidate.directChildNameSet.has(cellName)) matches++
  }
  return matches
}

function countReferencedFrameMatches(candidate: Candidate, track: XdtsTrack): number {
  let matches = 0
  for (const frame of track.frames) {
    if (frame.cellName === null) continue
    if (candidate.directChildNameSet.has(frame.cellName)) {
      matches++
    }
  }
  return matches
}

function pickBestCandidateIndex(pool: Candidate[], track: XdtsTrack): number {
  let bestIndex = 0
  let bestDistinctMatches = countDirectChildCellNameMatches(pool[0], track)
  let bestFrameMatches = countReferencedFrameMatches(pool[0], track)

  for (let i = 1; i < pool.length; i++) {
    const candidate = pool[i]
    const distinctMatches = countDirectChildCellNameMatches(candidate, track)
    const frameMatches = countReferencedFrameMatches(candidate, track)

    if (distinctMatches > bestDistinctMatches) {
      bestIndex = i
      bestDistinctMatches = distinctMatches
      bestFrameMatches = frameMatches
      continue
    }
    if (distinctMatches < bestDistinctMatches) continue

    if (frameMatches > bestFrameMatches) {
      bestIndex = i
      bestFrameMatches = frameMatches
      continue
    }
    if (frameMatches < bestFrameMatches) continue

    // 完全同点なら既存どおり pool の先頭側（ボトム優先）を維持する
  }

  return bestIndex
}

function pickCandidate(pool: Candidate[], track: XdtsTrack): Candidate | undefined {
  if (pool.length === 0) return undefined

  const visiblePool = pool.filter(candidate => candidate.effectivelyVisible)
  const activePool = visiblePool.length > 0 ? visiblePool : pool
  return activePool[pickBestCandidateIndex(activePool, track)]
}

export function assignTracksToFolders(
  tree: CspLayer[],
  tracks: XdtsTrack[],
): AssignResult {
  const assignment = new Map<string, number>()
  const unmatchedTracks: XdtsTrack[] = []

  if (tracks.length === 0) return { assignment, unmatchedTracks }

  // トラック raw 名のセット(候補収集時のフィルタに使用)
  const trackNameSet = new Set(tracks.map(t => t.name))

  // 候補をボトム優先で収集
  const allCandidates = collectCandidates(tree, trackNameSet)

  // raw 名 → ボトム優先候補プールを構築
  const poolsByName = new Map<string, Candidate[]>()
  for (const c of allCandidates) {
    let pool = poolsByName.get(c.rawName)
    if (!pool) {
      pool = []
      poolsByName.set(c.rawName, pool)
    }
    pool.push(c)
  }

  // 各トラックを trackNo 昇順に処理して割当
  const sortedTracks = [...tracks].sort((a, b) => a.trackNo - b.trackNo)
  for (const track of sortedTracks) {
    const pool = poolsByName.get(track.name)
    const picked = pool ? pickCandidate(pool, track) : undefined
    if (picked) {
      const pickedIndex = pool!.indexOf(picked)
      if (pickedIndex >= 0) pool!.splice(pickedIndex, 1)
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
