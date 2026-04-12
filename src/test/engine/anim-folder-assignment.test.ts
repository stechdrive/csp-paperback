import { describe, it, expect } from 'vitest'
import { assignTracksToFolders } from '../../engine/anim-folder-assignment'
import { buildLayerTree } from '../../engine/tree-builder'
import { makeLayer, makePsd, makeFolder } from '../helpers/psd-factory'
import type { CspLayer, XdtsTrack } from '../../types'

/**
 * XdtsTrack の簡易ファクトリ
 * frames/cellNames は省略可。構造優先の検証では実セル名を入れる。
 */
function makeTrack(
  name: string,
  trackNo: number,
  cellNames: string[] = [],
  frameCellNames: Array<string | null> = [],
): XdtsTrack {
  return {
    name,
    trackNo,
    cellNames,
    frames: frameCellNames.map((cellName, i) => ({ frameIndex: i, cellName })),
  }
}

/** id → CspLayer を再帰的に引くユーティリティ */
function findLayer(tree: CspLayer[], pathNames: string[]): CspLayer | null {
  // トップから順に名前でたどる
  let current: CspLayer[] = tree
  let found: CspLayer | null = null
  for (const name of pathNames) {
    const next = current.find(l => l.originalName === name)
    if (!next) return null
    found = next
    current = next.children
  }
  return found
}

describe('assignTracksToFolders', () => {
  it('XDTS が空なら空の割当結果を返す', () => {
    const psd = makePsd({ children: [makeFolder('A', [])] })
    const tree = buildLayerTree(psd)
    const result = assignTracksToFolders(tree, [])
    expect(result.assignment.size).toBe(0)
    expect(result.unmatchedTracks).toHaveLength(0)
  })

  it('1 トラック × 1 候補 → 割当成功', () => {
    const psd = makePsd({ children: [makeFolder('A', [makeLayer({ name: '1' })])] })
    const tree = buildLayerTree(psd)
    const result = assignTracksToFolders(tree, [makeTrack('A', 0)])
    expect(result.assignment.size).toBe(1)
    expect(result.unmatchedTracks).toHaveLength(0)
    const layerA = findLayer(tree, ['A'])!
    expect(result.assignment.get(layerA.id)).toBe(0)
  })

  it('同名の子セルを含む親フォルダを、セル名一致で優先する', () => {
    // 構造:
    // A
    // ├─ A(hidden)  ← 子セル
    // ├─ A         ← 子セル
    // └─ B         ← 子セル
    //
    // track "A" の実セル名集合は [A, B]。
    // 現実にアニメーションフォルダとして選ぶべきなのは親の A で、
    // 子の A はセルフォルダとして扱うべき。
    const hiddenA = makeFolder('A', [makeLayer({ name: 'hidden-content' })])
    hiddenA.hidden = true
    const visibleA = makeFolder('A', [makeLayer({ name: 'visible-content' })])
    const visibleB = makeFolder('B', [makeLayer({ name: 'visible-content' })])
    const rootA = makeFolder('A', [hiddenA, visibleA, visibleB])
    const psd = makePsd({ children: [rootA] })
    const tree = buildLayerTree(psd)

    const result = assignTracksToFolders(tree, [
      makeTrack('A', 0, ['A', 'B'], ['A', 'A', 'B']),
    ])

    const root = findLayer(tree, ['A'])!
    const childHiddenA = findLayer(tree, ['A', 'A'])!

    expect(result.assignment.size).toBe(1)
    expect(result.unmatchedTracks).toHaveLength(0)
    expect(result.assignment.get(root.id)).toBe(0)
    expect(result.assignment.get(childHiddenA.id)).toBeUndefined()
  })

  it('同名 2 候補 × 2 トラック → ボトム優先で trackNo 0/1 に割当', () => {
    // 2 つの A フォルダを用意。1 つ目を渡す = PSD ボトム = 画面上の一番下
    const bottomA = makeFolder('A', [makeLayer({ name: '1' })])
    const topA = makeFolder('A', [makeLayer({ name: '2' })])
    const psd = makePsd({ children: [bottomA, topA] })  // ag-psd はボトムファースト
    const tree = buildLayerTree(psd)

    // tree[0] = topA (トップファーストに逆転後の先頭 = 画面上で一番上)
    // tree[1] = bottomA (画面上で一番下)
    const treeTopA = tree[0]
    const treeBottomA = tree[1]
    expect(treeTopA.originalName).toBe('A')
    expect(treeBottomA.originalName).toBe('A')
    // 区別のため子の名前で確認
    expect(treeBottomA.children[0].originalName).toBe('1')
    expect(treeTopA.children[0].originalName).toBe('2')

    const result = assignTracksToFolders(tree, [makeTrack('A', 0), makeTrack('A', 1)])
    expect(result.assignment.size).toBe(2)
    expect(result.unmatchedTracks).toHaveLength(0)
    // trackNo 0 → ボトムの A
    expect(result.assignment.get(treeBottomA.id)).toBe(0)
    // trackNo 1 → トップの A
    expect(result.assignment.get(treeTopA.id)).toBe(1)
  })

  it('余剰候補(トラック数より候補数が多い)は未割当のまま', () => {
    // 3 candidates, 2 tracks → 1 余る。余った候補は assignment に入らない
    const a1 = makeFolder('A', [makeLayer({ name: '1' })])
    const a2 = makeFolder('A', [makeLayer({ name: '2' })])
    const a3 = makeFolder('A', [makeLayer({ name: '3' })])
    const psd = makePsd({ children: [a1, a2, a3] })
    const tree = buildLayerTree(psd)

    const result = assignTracksToFolders(tree, [makeTrack('A', 0), makeTrack('A', 1)])
    expect(result.assignment.size).toBe(2)
    expect(result.unmatchedTracks).toHaveLength(0)  // XDTS 側からみて不一致なし
  })

  it('候補不足(トラック数より候補数が少ない)は unmatchedTracks に入る', () => {
    const psd = makePsd({ children: [makeFolder('A', [makeLayer({ name: '1' })])] })
    const tree = buildLayerTree(psd)
    const result = assignTracksToFolders(tree, [makeTrack('A', 0), makeTrack('A', 1)])
    expect(result.assignment.size).toBe(1)
    expect(result.unmatchedTracks).toHaveLength(1)
    expect(result.unmatchedTracks[0].trackNo).toBe(1)
  })

  it('autoMarked 祖先配下の候補も通常候補として扱い、ボトム順で割当する', () => {
    // _TEST/A (祖先 mark あり) と LO/A (祖先 mark なし) がある
    // XDTS "A" 1 トラック → ボトム側の LO/A が選ばれる
    const aInTest = makeFolder('A', [makeLayer({ name: '1' })])
    const test = makeFolder('_TEST', [aInTest])
    const aInLo = makeFolder('A', [makeLayer({ name: '2' })])
    const lo = makeFolder('LO', [aInLo])
    const psd = makePsd({ children: [lo, test] })  // ag-psd ボトムファースト: lo, test
    const tree = buildLayerTree(psd)

    const result = assignTracksToFolders(tree, [makeTrack('A', 0)])
    expect(result.assignment.size).toBe(1)
    const loA = findLayer(tree, ['LO', 'A'])!
    const testA = findLayer(tree, ['_TEST', 'A'])!
    expect(result.assignment.get(loA.id)).toBe(0)
    expect(result.assignment.get(testA.id)).toBeUndefined()
  })

  it('autoMarked 祖先配下だけに候補がある場合も割当する', () => {
    // _TEST/A が 1 つだけ、LO 側にはなし
    // XDTS "A" 1 トラック → _TEST/A が選ばれる
    const aInTest = makeFolder('A', [makeLayer({ name: '1' })])
    const test = makeFolder('_TEST', [aInTest])
    const psd = makePsd({ children: [test] })
    const tree = buildLayerTree(psd)

    const result = assignTracksToFolders(tree, [makeTrack('A', 0)])
    expect(result.assignment.size).toBe(1)
    const testA = findLayer(tree, ['_TEST', 'A'])!
    expect(result.assignment.get(testA.id)).toBe(0)
  })

  it('末尾空白 "A " と "A" は別トラックとして扱い、raw 名が一致する候補だけを使う', () => {
    const spaceA = makeFolder('A ', [makeLayer({ name: '1' })])
    const noSpaceA = makeFolder('A', [makeLayer({ name: '2' })])
    const psd = makePsd({ children: [spaceA, noSpaceA] })
    const tree = buildLayerTree(psd)

    const result = assignTracksToFolders(tree, [makeTrack('A', 0)])
    expect(result.assignment.size).toBe(1)
    const treeSpaceA = tree.find(l => l.originalName === 'A ')!
    const treeNoSpaceA = tree.find(l => l.originalName === 'A')!
    expect(result.assignment.get(treeNoSpaceA.id)).toBe(0)
    expect(result.assignment.get(treeSpaceA.id)).toBeUndefined()
  })

  it('XDTS 側の "A " はツリーの "A " にだけ一致する', () => {
    const psd = makePsd({
      children: [
        makeFolder('A ', [makeLayer({ name: '1' })]),
        makeFolder('A', [makeLayer({ name: '2' })]),
      ],
    })
    const tree = buildLayerTree(psd)
    const result = assignTracksToFolders(tree, [makeTrack('A ', 0)])
    expect(result.assignment.size).toBe(1)
    const layerSpaceA = tree.find(layer => layer.originalName === 'A ')!
    const layerA = tree.find(layer => layer.originalName === 'A')!
    expect(result.assignment.get(layerSpaceA.id)).toBe(0)
    expect(result.assignment.get(layerA.id)).toBeUndefined()
  })

  it('AB / ab / ab  は raw 名ごとに別プールで扱う', () => {
    const psd = makePsd({
      children: [
        makeFolder('AB', [makeLayer({ name: '1' })]),
        makeFolder('ab', [makeLayer({ name: '2' })]),
        makeFolder('ab ', [makeLayer({ name: '3' })]),
      ],
    })
    const tree = buildLayerTree(psd)
    const result = assignTracksToFolders(tree, [
      makeTrack('AB', 0),
      makeTrack('ab', 1),
      makeTrack('ab ', 2),
    ])

    expect(result.assignment.size).toBe(3)
    expect(result.unmatchedTracks).toHaveLength(0)
    expect(result.assignment.get(findLayer(tree, ['AB'])!.id)).toBe(0)
    expect(result.assignment.get(findLayer(tree, ['ab'])!.id)).toBe(1)
    expect(result.assignment.get(findLayer(tree, ['ab '])!.id)).toBe(2)
  })

  it('自身が autoMarked のフォルダでも XDTS track 名に一致すれば候補になる', () => {
    // _A というフォルダは XDTS "_A" と raw 一致し、XDTS 検出を優先する
    const underA = makeFolder('_A', [makeLayer({ name: '1' })])
    const psd = makePsd({ children: [underA] })
    const tree = buildLayerTree(psd)

    // _A は autoMarked のはず
    expect(tree[0].autoMarked).toBe(true)

    const result = assignTracksToFolders(tree, [makeTrack('_A', 0)])
    expect(result.assignment.size).toBe(1)
    expect(result.assignment.get(tree[0].id)).toBe(0)
    expect(result.unmatchedTracks).toHaveLength(0)
  })

  it('hidden/uiHidden なフォルダも XDTS 検出フェーズでは候補になる', () => {
    const hiddenA = makeLayer({ name: 'A', isFolder: true, children: [makeLayer({ name: '1' })], hidden: true })
    const psd = makePsd({ children: [hiddenA] })
    const tree = buildLayerTree(psd)
    const result = assignTracksToFolders(tree, [makeTrack('A', 0)])
    expect(result.assignment.size).toBe(1)
    expect(result.assignment.get(tree[0].id)).toBe(0)
    expect(result.unmatchedTracks).toHaveLength(0)

    tree[0].uiHidden = true
    const resultWithUiHidden = assignTracksToFolders(tree, [makeTrack('A', 0)])
    expect(resultWithUiHidden.assignment.size).toBe(1)
    expect(resultWithUiHidden.assignment.get(tree[0].id)).toBe(0)
    expect(resultWithUiHidden.unmatchedTracks).toHaveLength(0)
  })

  it('同名候補に実効可視の候補がある場合は hidden な祖先配下より優先する', () => {
    // hidden branch を PSD ボトム側に置き、従来のボトム優先だけならそちらが選ばれる構図にする。
    // ただし今回は visible branch を優先したい。
    const hiddenBranch = makeFolder('LO', [
      makeFolder('AB', [
        makeLayer({ name: 'A2' }),
        makeLayer({ name: 'B3' }),
        makeLayer({ name: 'A1_B1' }),
      ]),
    ])
    hiddenBranch.hidden = true

    const visibleBranch = makeFolder('演出', [
      makeFolder('AB', [
        makeLayer({ name: 'A2' }),
        makeLayer({ name: 'B3' }),
        makeLayer({ name: 'A1_B1' }),
      ]),
    ])

    const root = makeFolder('ROOT', [hiddenBranch, visibleBranch])
    const psd = makePsd({ children: [root] })
    const tree = buildLayerTree(psd)

    const result = assignTracksToFolders(tree, [
      makeTrack('AB', 0, ['A1_B1', 'B3', 'A2'], ['A1_B1', 'B3', 'A2']),
    ])

    const hiddenAb = findLayer(tree, ['ROOT', 'LO', 'AB'])!
    const visibleAb = findLayer(tree, ['ROOT', '演出', 'AB'])!

    expect(result.assignment.size).toBe(1)
    expect(result.unmatchedTracks).toHaveLength(0)
    expect(result.assignment.get(visibleAb.id)).toBe(0)
    expect(result.assignment.get(hiddenAb.id)).toBeUndefined()
  })

  it('実効可視の候補がある間は、セル一致が少し低くても hidden 候補より先に使う', () => {
    const hiddenBranch = makeFolder('LO', [
      makeFolder('AB', [
        makeLayer({ name: 'A2' }),
        makeLayer({ name: 'B3' }),
        makeLayer({ name: 'A1_B1' }),
      ]),
    ])
    hiddenBranch.hidden = true

    const visibleBranch = makeFolder('演出', [
      makeFolder('AB', [
        makeLayer({ name: 'B3' }),
        makeLayer({ name: 'A1_B1' }),
      ]),
    ])

    const root = makeFolder('ROOT', [hiddenBranch, visibleBranch])
    const psd = makePsd({ children: [root] })
    const tree = buildLayerTree(psd)

    const result = assignTracksToFolders(tree, [
      makeTrack('AB', 0, ['A1_B1', 'B3', 'A2'], ['A1_B1', 'B3', 'A2']),
    ])

    const hiddenAb = findLayer(tree, ['ROOT', 'LO', 'AB'])!
    const visibleAb = findLayer(tree, ['ROOT', '演出', 'AB'])!

    expect(result.assignment.size).toBe(1)
    expect(result.unmatchedTracks).toHaveLength(0)
    expect(result.assignment.get(visibleAb.id)).toBe(0)
    expect(result.assignment.get(hiddenAb.id)).toBeUndefined()
  })

  it('実効可視の候補を使い切ったら hidden 候補にフォールバックする', () => {
    const hiddenBranch = makeFolder('LO', [
      makeFolder('AB', [
        makeLayer({ name: 'A2' }),
        makeLayer({ name: 'B3' }),
        makeLayer({ name: 'A1_B1' }),
      ]),
    ])
    hiddenBranch.hidden = true

    const visibleBranch = makeFolder('演出', [
      makeFolder('AB', [
        makeLayer({ name: 'A2' }),
        makeLayer({ name: 'B3' }),
        makeLayer({ name: 'A1_B1' }),
      ]),
    ])

    const root = makeFolder('ROOT', [hiddenBranch, visibleBranch])
    const psd = makePsd({ children: [root] })
    const tree = buildLayerTree(psd)

    const result = assignTracksToFolders(tree, [
      makeTrack('AB', 0, ['A1_B1', 'B3', 'A2'], ['A1_B1', 'B3', 'A2']),
      makeTrack('AB', 1, ['A1_B1', 'B3', 'A2'], ['A1_B1', 'B3', 'A2']),
    ])

    const hiddenAb = findLayer(tree, ['ROOT', 'LO', 'AB'])!
    const visibleAb = findLayer(tree, ['ROOT', '演出', 'AB'])!

    expect(result.assignment.size).toBe(2)
    expect(result.unmatchedTracks).toHaveLength(0)
    expect(result.assignment.get(visibleAb.id)).toBe(0)
    expect(result.assignment.get(hiddenAb.id)).toBe(1)
  })

  it('yc4_00_000_lo 相当のシナリオ: 同名 3 候補 + _TEST/A 余剰', () => {
    // ツリー:
    //   _TEST/A (祖先 mark あり、余剰候補)
    //   LO/TEST(top)/A (cell "4" 持ち、優先 1)
    //   LO/TEST(bottom)/A (中段、優先 1)
    //   LO/TEST(bottom)/A  (末尾空白、最下段、優先 1)
    // XDTS: [A , A, A] (trackNo 0, 1, 2)
    // 期待: ボトム 3 つに trackNo 0, 1, 2、_TEST/A は未割当(unmatched ではない、余剰扱い)

    const testBottom = makeFolder('TEST', [
      makeFolder('A ', [makeLayer({ name: '1' })]),  // ag-psd ボトム(末尾空白)
      makeFolder('A', [makeLayer({ name: '2' })]),   // ag-psd トップ(no space)
    ])
    const testTop = makeFolder('TEST', [
      makeLayer({ name: '演出(サクラ)' }),
      makeFolder('A', [makeLayer({ name: '4' })]),
    ])
    const lo = makeFolder('LO', [testBottom, testTop])

    const aInTest = makeFolder('A', [makeLayer({ name: 'レイヤー 1' })])
    const test = makeFolder('_TEST', [aInTest])

    // ag-psd はボトムファースト: lo が下、_TEST が上
    const psd = makePsd({ children: [lo, test] })
    const tree = buildLayerTree(psd)

    const result = assignTracksToFolders(tree, [
      makeTrack('A ', 0),
      makeTrack('A', 1),
      makeTrack('A', 2),
    ])

    expect(result.assignment.size).toBe(3)
    expect(result.unmatchedTracks).toHaveLength(0)

    // 割当先を構造的に引いて検証
    // buildLayerTree 後の tree:
    //   tree[0] = _TEST (トップ)
    //     children[0] = A
    //   tree[1] = LO
    //     children[0] = TEST(top)     ← LO の CSP 表示で上
    //       children[0] = A (cell "4")
    //       children[1] = 演出(サクラ)
    //     children[1] = TEST(bottom) ← LO の CSP 表示で下
    //       children[0] = A (no space, 中段)
    //       children[1] = A  (末尾空白, 最下段)

    const testTopA = tree[1].children[0].children[0]
    const testBottomNoSpaceA = tree[1].children[1].children[0]
    const testBottomSpaceA = tree[1].children[1].children[1]
    const underTestA = tree[0].children[0]

    expect(testBottomSpaceA.originalName).toBe('A ')
    expect(testBottomNoSpaceA.originalName).toBe('A')
    expect(testTopA.originalName).toBe('A')
    expect(underTestA.originalName).toBe('A')

    // trackNo 0 → 最下段の A (末尾空白)
    expect(result.assignment.get(testBottomSpaceA.id)).toBe(0)
    // trackNo 1 → 中段の A (no space)
    expect(result.assignment.get(testBottomNoSpaceA.id)).toBe(1)
    // trackNo 2 → 上段の A (cell "4" 持ち)
    expect(result.assignment.get(testTopA.id)).toBe(2)
    // _TEST/A は余剰、割当なし
    expect(result.assignment.get(underTestA.id)).toBeUndefined()
  })
})
