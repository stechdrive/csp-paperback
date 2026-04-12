import { describe, it, expect } from 'vitest'
import { computeDisplayNames } from '../../engine/anim-folder-display-name'
import { buildLayerTree } from '../../engine/tree-builder'
import { makeLayer, makePsd, makeFolder } from '../helpers/psd-factory'

/**
 * namespace / family ベースの displayName 計算テスト。
 *
 * 前提:
 * - assignment は `{layerId → trackNo}` の対応付け(assignTracksToFolders の結果を想定)
 * - parentSuffixByLayerId は `{layerId → parentSuffix}` で、processTable 由来の工程 suffix
 *   (通常 "" で、工程フォルダ配下のみ "_e", "_s" 等が入る)
 *
 * namespace = parentSuffix
 * family = trim 後の name を case-insensitive に見た値
 * - 同一 family 内に複数メンバ → (n) 連番
 * - 異なる namespace は連番付けしない (例: c001 の 作画/A と 演出/A)
 */
describe('computeDisplayNames', () => {
  const EMPTY_SUFFIX = new Map<string, string>()

  it('assignment が空なら空の Map を返す', () => {
    const psd = makePsd({ children: [makeFolder('A', [])] })
    const tree = buildLayerTree(psd)
    const result = computeDisplayNames(tree, new Map(), EMPTY_SUFFIX)
    expect(result.size).toBe(0)
  })

  it('単独フォルダ 1 つ → base そのまま', () => {
    const psd = makePsd({ children: [makeFolder('A', [makeLayer({ name: '1' })])] })
    const tree = buildLayerTree(psd)
    const layerA = tree[0]
    const result = computeDisplayNames(tree, new Map([[layerA.id, 0]]), EMPTY_SUFFIX)
    expect(result.get(layerA.id)).toBe('A')
  })

  it('同一 family 2 つ → "A", "A(2)" (ボトム優先 = trackNo 昇順)', () => {
    const aBottom = makeFolder('A', [makeLayer({ name: '1' })])
    const aTop = makeFolder('A', [makeLayer({ name: '2' })])
    const psd = makePsd({ children: [aBottom, aTop] })  // ag-psd ボトムファースト
    const tree = buildLayerTree(psd)
    // tree[0] = top, tree[1] = bottom
    const treeTop = tree[0]
    const treeBottom = tree[1]

    const assignment = new Map<string, number>([
      [treeBottom.id, 0],
      [treeTop.id, 1],
    ])
    const result = computeDisplayNames(tree, assignment, EMPTY_SUFFIX)

    expect(result.get(treeBottom.id)).toBe('A')
    expect(result.get(treeTop.id)).toBe('A(2)')
  })

  it('同一 family 3 つ → "A", "A(2)", "A(3)"', () => {
    const a1 = makeFolder('A', [makeLayer({ name: '1' })])
    const a2 = makeFolder('A', [makeLayer({ name: '2' })])
    const a3 = makeFolder('A', [makeLayer({ name: '3' })])
    const psd = makePsd({ children: [a1, a2, a3] })
    const tree = buildLayerTree(psd)
    const [t0, t1, t2] = tree  // top to bottom
    const assignment = new Map<string, number>([
      [t2.id, 0],  // bottom
      [t1.id, 1],
      [t0.id, 2],  // top
    ])
    const result = computeDisplayNames(tree, assignment, EMPTY_SUFFIX)
    expect(result.get(t2.id)).toBe('A')
    expect(result.get(t1.id)).toBe('A(2)')
    expect(result.get(t0.id)).toBe('A(3)')
  })

  it('末尾空白 "A " と "A" は同じ family (trim 後同名), ボトム優先で連番', () => {
    const aSpace = makeFolder('A ', [makeLayer({ name: '1' })])
    const aNormal = makeFolder('A', [makeLayer({ name: '2' })])
    const psd = makePsd({ children: [aSpace, aNormal] })
    const tree = buildLayerTree(psd)
    const treeNormal = tree[0]
    const treeSpace = tree[1]

    const assignment = new Map<string, number>([
      [treeSpace.id, 0],   // bottom = "A "
      [treeNormal.id, 1],  // top = "A"
    ])
    const result = computeDisplayNames(tree, assignment, EMPTY_SUFFIX)

    // ボトム("A ")は trim されて base "A"、次の同一 family メンバは "A(2)"
    expect(result.get(treeSpace.id)).toBe('A')
    expect(result.get(treeNormal.id)).toBe('A(2)')
  })

  it('c001 ケース: 同名 A 2 つだが parentSuffix が異なる → 両方 "A" (別 namespace)', () => {
    // 作画/A (suffix="") と 演出/A (suffix="_e") のように namespace が分かれる場合、
    // どちらも displayName "A" で、fileName で parentSuffix による分岐が行われる
    const workA = makeFolder('A', [makeLayer({ name: '1' })])
    const enshutsuA = makeFolder('A', [makeLayer({ name: '2' })])
    const psd = makePsd({ children: [workA, enshutsuA] })
    const tree = buildLayerTree(psd)
    // tree[0] = enshutsuA (top), tree[1] = workA (bottom)
    const treeEnshutsu = tree[0]
    const treeWork = tree[1]

    const assignment = new Map<string, number>([
      [treeWork.id, 0],       // trackNo 0 = 作画/A
      [treeEnshutsu.id, 2],   // trackNo 2 = 演出/A (別トラック、process variant)
    ])
    const parentSuffixes = new Map<string, string>([
      [treeWork.id, ''],        // 作画 は processTable に無い
      [treeEnshutsu.id, '_e'],  // 演出 は processTable で suffix _e
    ])
    const result = computeDisplayNames(tree, assignment, parentSuffixes)

    // 両方とも displayName "A"(別 namespace なので連番なし)
    expect(result.get(treeWork.id)).toBe('A')
    expect(result.get(treeEnshutsu.id)).toBe('A')
  })

  it('同一 family 3 つ + 別 namespace 1 つ: 連番は同一 namespace 内だけ', () => {
    // 3 つの同名 A (全部 parentSuffix="") と 1 つの別 namespace A (parentSuffix="_e")
    const a1 = makeFolder('A', [makeLayer({ name: '1' })])
    const a2 = makeFolder('A', [makeLayer({ name: '2' })])
    const a3 = makeFolder('A', [makeLayer({ name: '3' })])
    const a4 = makeFolder('A', [makeLayer({ name: '4' })])
    const psd = makePsd({ children: [a1, a2, a3, a4] })
    const tree = buildLayerTree(psd)
    // tree[0]=a4 (top), tree[1]=a3, tree[2]=a2, tree[3]=a1 (bottom)
    const [t0, t1, t2, t3] = tree

    const assignment = new Map<string, number>([
      [t3.id, 0],  // bottom
      [t2.id, 1],
      [t1.id, 2],
      [t0.id, 3],  // top
    ])
    // t0 だけ別 namespace (suffix="_e"), 残り 3 つは suffix=""
    const parentSuffixes = new Map<string, string>([
      [t3.id, ''],
      [t2.id, ''],
      [t1.id, ''],
      [t0.id, '_e'],
    ])
    const result = computeDisplayNames(tree, assignment, parentSuffixes)

    // namespace "" / family "a": 3 members → "A", "A(2)", "A(3)"
    expect(result.get(t3.id)).toBe('A')  // trackNo 0
    expect(result.get(t2.id)).toBe('A(2)')  // trackNo 1
    expect(result.get(t1.id)).toBe('A(3)')  // trackNo 2
    // namespace "_e": 1 member → "A"
    expect(result.get(t0.id)).toBe('A')
  })

  it('literal "A(2)" が同じ parentSuffix 空間に存在 → 自動番号は (3) にスキップ', () => {
    // ツリー: A, A, A(2) の 3 フォルダ。XDTS は全部割当
    // A 2 つは同一 family、literal "A(2)" は別 family だが同じ namespace
    // 期待: A → "A", A → "A(2)" だが literal と衝突 → "A(3)"
    const a1 = makeFolder('A', [makeLayer({ name: '1' })])
    const a2 = makeFolder('A', [makeLayer({ name: '2' })])
    const literalA2 = makeFolder('A(2)', [makeLayer({ name: '3' })])
    const psd = makePsd({ children: [a1, a2, literalA2] })
    const tree = buildLayerTree(psd)
    const treeLiteral = tree[0]
    const treeA2 = tree[1]
    const treeA1 = tree[2]

    const assignment = new Map<string, number>([
      [treeA1.id, 0],       // "A" bottom
      [treeA2.id, 1],       // "A" middle
      [treeLiteral.id, 2],  // "A(2)" literal
    ])
    const result = computeDisplayNames(tree, assignment, EMPTY_SUFFIX)

    // family "a": [treeA1, treeA2] → "A", (2 をスキップして) "A(3)"
    expect(result.get(treeA1.id)).toBe('A')
    expect(result.get(treeA2.id)).toBe('A(3)')
    // literal family "a(2)": base "A(2)" をそのまま使う
    expect(result.get(treeLiteral.id)).toBe('A(2)')
  })

  it('case-insensitive 衝突も回避する(Windows FS 安全性)', () => {
    const a1 = makeFolder('A', [makeLayer({ name: '1' })])
    const a2 = makeFolder('A', [makeLayer({ name: '2' })])
    const literalLowerA2 = makeFolder('a(2)', [makeLayer({ name: '3' })])
    const psd = makePsd({ children: [a1, a2, literalLowerA2] })
    const tree = buildLayerTree(psd)
    const treeLiteral = tree[0]
    const treeA2 = tree[1]
    const treeA1 = tree[2]

    const assignment = new Map<string, number>([
      [treeA1.id, 0],
      [treeA2.id, 1],
      [treeLiteral.id, 2],
    ])
    const result = computeDisplayNames(tree, assignment, EMPTY_SUFFIX)

    expect(result.get(treeA1.id)).toBe('A')
    expect(result.get(treeA2.id)).toBe('A(3)')
    expect(result.get(treeLiteral.id)).toBe('a(2)')
  })

  it('A と a は別 raw 名を保持しつつ、同じ family 内で連番解決する', () => {
    const upperA = makeFolder('A', [makeLayer({ name: '1' })])
    const lowerA = makeFolder('a', [makeLayer({ name: '2' })])
    const psd = makePsd({ children: [upperA, lowerA] })
    const tree = buildLayerTree(psd)
    const treeLower = tree.find(layer => layer.originalName === 'A')!
    const treeUpper = tree.find(layer => layer.originalName === 'a')!

    const assignment = new Map<string, number>([
      [treeLower.id, 0],
      [treeUpper.id, 1],
    ])
    const result = computeDisplayNames(tree, assignment, EMPTY_SUFFIX)

    expect(result.get(treeLower.id)).toBe('A')
    expect(result.get(treeUpper.id)).toBe('a(2)')
  })

  it('異なる名前グループは独立に扱う', () => {
    const a1 = makeFolder('A', [makeLayer({ name: '1' })])
    const a2 = makeFolder('A', [makeLayer({ name: '2' })])
    const b1 = makeFolder('B', [makeLayer({ name: '3' })])
    const b2 = makeFolder('B', [makeLayer({ name: '4' })])
    const psd = makePsd({ children: [a1, a2, b1, b2] })
    const tree = buildLayerTree(psd)
    const [tB2, tB1, tA2, tA1] = tree

    const assignment = new Map<string, number>([
      [tA1.id, 0],
      [tA2.id, 1],
      [tB1.id, 2],
      [tB2.id, 3],
    ])
    const result = computeDisplayNames(tree, assignment, EMPTY_SUFFIX)

    expect(result.get(tA1.id)).toBe('A')
    expect(result.get(tA2.id)).toBe('A(2)')
    expect(result.get(tB1.id)).toBe('B')
    expect(result.get(tB2.id)).toBe('B(2)')
  })

  it('yc4 シナリオ: 同一 family 3 つ(うち 1 つは末尾空白)→ "A", "A(2)", "A(3)"', () => {
    const aSpace = makeFolder('A ', [makeLayer({ name: '1' })])  // bottom
    const aMiddle = makeFolder('A', [makeLayer({ name: '2' })])
    const aTop = makeFolder('A', [makeLayer({ name: '4' })])  // top
    const psd = makePsd({ children: [aSpace, aMiddle, aTop] })
    const tree = buildLayerTree(psd)
    const treeTop = tree[0]
    const treeMiddle = tree[1]
    const treeSpace = tree[2]

    const assignment = new Map<string, number>([
      [treeSpace.id, 0],
      [treeMiddle.id, 1],
      [treeTop.id, 2],
    ])
    const result = computeDisplayNames(tree, assignment, EMPTY_SUFFIX)

    expect(result.get(treeSpace.id)).toBe('A')
    expect(result.get(treeMiddle.id)).toBe('A(2)')
    expect(result.get(treeTop.id)).toBe('A(3)')
  })
})
