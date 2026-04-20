import { describe, it, expect } from 'vitest'
import { extractCells, extractMarkedLayers, extractAllEntries } from '../../engine/cell-extractor'
import { buildLayerTree, detectAnimationFoldersByXdts, promoteAutoMarkedByProcessMatch } from '../../engine/tree-builder'
import { makeLayer, makePsd, makeFolder, makeAnimationFolder } from '../helpers/psd-factory'
import type { CspLayer, ProjectSettings, XdtsData, FlatLayer } from '../../types'

const DEFAULT_SETTINGS: ProjectSettings = {
  processTable: [],
  cellNamingMode: 'sequence',
  archivePatterns: [],
}

const CELL_NAME_SETTINGS: ProjectSettings = {
  processTable: [],
  cellNamingMode: 'cellname',
  archivePatterns: [],
}

const EMPTY_CONTEXT: FlatLayer[] = []

function makeSettingsWithTable(entries: { suffix: string; folderNames: string[] }[]): ProjectSettings {
  return { processTable: entries, cellNamingMode: 'sequence', archivePatterns: [] }
}

function detectAnim(tree: ReturnType<typeof buildLayerTree>, trackName: string) {
  const xdts: XdtsData = { tracks: [{ name: trackName, trackNo: 0, cellNames: [], frames: [] }], version: 5, header: { cut: '1', scene: '1' }, timeTableName: 'タイムライン1', duration: 72, fps: 24 }
  detectAnimationFoldersByXdts(tree, xdts)
}

function markManualAnimFolder(layer: CspLayer): void {
  layer.isAnimationFolder = true
  layer.animationFolder = { detectedBy: 'manual', trackName: layer.originalName }
}

describe('extractCells', () => {
  it('アニメフォルダでない場合は空配列を返す', () => {
    const psd = makePsd({ children: [makeFolder('A', [])] })
    const tree = buildLayerTree(psd)
    expect(extractCells(tree[0], DEFAULT_SETTINGS, 100, 100, EMPTY_CONTEXT)).toHaveLength(0)
  })

  it('単体レイヤーのセルはレイヤー名でそのまま出力する', () => {
    // 単体レイヤー = XDTSキーフレーム画像 → processTableを見ずにそのまま1セル出力
    const cell1 = makeLayer({ name: '1' })
    const cell2 = makeLayer({ name: '2' })
    // buildLayerTree はボトムファースト→トップファーストに逆転するため末尾が tree[0]
    const animFolder = makeAnimationFolder('A', [cell2, cell1])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    const result = extractCells(tree[0], DEFAULT_SETTINGS, 100, 100, EMPTY_CONTEXT)
    expect(result).toHaveLength(2)
    // 連番はアニメフォルダ内の下セルから順に 0001 を割り当てる（CSP表示順と逆）
    // tree[0].children[0] = '1' (上), [1] = '2' (下)
    // 上セル(index 0) → 0002, 下セル(index 1) → 0001
    expect(result[0].flatName).toBe('A_0002.jpg')
    expect(result[0].path).toBe('A/A_0002.jpg')
    expect(result[1].flatName).toBe('A_0001.jpg')
  })

  it('セル名出力では同一アニメフォルダ内の同名セルを _2 で回避する', () => {
    const bottomCell = makeLayer({ name: 'あ' })
    const topCell = makeLayer({ name: 'あ' })
    const animFolder = makeAnimationFolder('A', [bottomCell, topCell])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    const result = extractCells(tree[0], CELL_NAME_SETTINGS, 100, 100, EMPTY_CONTEXT)
    expect(result).toHaveLength(2)
    expect(result[0].flatName).toBe('A_あ.jpg')
    expect(result[1].flatName).toBe('A_あ_2.jpg')
    expect(result[0].sourceCellId).toBe(tree[0].children[0].id)
    expect(result[1].sourceCellId).toBe(tree[0].children[1].id)
  })

  it('非表示セルを除外する', () => {
    const cell1 = makeLayer({ name: 'c1', hidden: false })
    const cell2 = makeLayer({ name: 'c2', hidden: true })
    const animFolder = makeAnimationFolder('A', [cell2, cell1])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    const result = extractCells(tree[0], DEFAULT_SETTINGS, 100, 100, EMPTY_CONTEXT)
    expect(result).toHaveLength(1)
    expect(result[0].flatName).toBe('A_0001.jpg')
  })

  it('フォルダセル: processTableにマッチするサブフォルダを工程別に出力する', () => {
    const enFolder = makeFolder('EN', [makeLayer({ name: 'line' })])
    const bodyLayer = makeLayer({ name: 'body' })
    // psd.children 末尾がトップになる（reversal）
    const cellFolder = makeFolder('A0001', [bodyLayer, enFolder])
    const animFolder = makeAnimationFolder('A', [cellFolder])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    const settings = makeSettingsWithTable([{ suffix: '_en', folderNames: ['EN', '演出修正'] }])
    const result = extractCells(tree[0], settings, 100, 100, EMPTY_CONTEXT)

    // A0001.jpg（本体）と A0001_en.jpg（工程）の2枚
    expect(result).toHaveLength(2)
    const names = result.map(e => e.flatName).sort()
    expect(names).toContain('A_0001.jpg')
    expect(names).toContain('A_0001_en.jpg')
  })

  it('工程名をセル番号の前に挿入して出力できる', () => {
    const enFolder = makeFolder('EN', [makeLayer({ name: 'line' })])
    const cellFolder = makeFolder('A0001', [enFolder])
    const animFolder = makeAnimationFolder('A', [cellFolder])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    const settings = makeSettingsWithTable([{ suffix: '_en', folderNames: ['EN'] }])
    const result = extractCells(
      tree[0], settings, 100, 100, EMPTY_CONTEXT,
      '', undefined, 'white', [], 'before-cell',
    )

    expect(result).toHaveLength(1)
    expect(result[0].flatName).toBe('A_en_0001.jpg')
    expect(result[0].path).toBe('A/A_en_0001.jpg')
    expect(result[0].processSuffixes).toEqual(['_en'])
  })

  it('フォルダセル: processTableに未登録のサブフォルダは本体として合成する', () => {
    const unknownFolder = makeFolder('UNKNOWN', [makeLayer()])
    const cellFolder = makeFolder('A0001', [unknownFolder])
    const animFolder = makeAnimationFolder('A', [cellFolder])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    const settings = makeSettingsWithTable([{ suffix: '_en', folderNames: ['EN'] }])
    const result = extractCells(tree[0], settings, 100, 100, EMPTY_CONTEXT)
    expect(result).toHaveLength(1)
    expect(result[0].flatName).toBe('A_0001.jpg')
  })

  it('フォルダ名照合は大文字小文字を区別しない', () => {
    const enFolder = makeFolder('en', [makeLayer()])
    const cellFolder = makeFolder('A0001', [enFolder])
    const animFolder = makeAnimationFolder('A', [cellFolder])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    const settings = makeSettingsWithTable([{ suffix: '_en', folderNames: ['EN'] }])
    const result = extractCells(tree[0], settings, 100, 100, EMPTY_CONTEXT)
    expect(result.map(e => e.flatName)).toContain('A_0001_en.jpg')
  })

  it('フォルダセル: 本体レイヤーがなく工程フォルダのみの場合は工程のみ出力する', () => {
    const enFolder = makeFolder('EN', [makeLayer()])
    const cellFolder = makeFolder('A0001', [enFolder])
    const animFolder = makeAnimationFolder('A', [cellFolder])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    const settings = makeSettingsWithTable([{ suffix: '_en', folderNames: ['EN'] }])
    const result = extractCells(tree[0], settings, 100, 100, EMPTY_CONTEXT)
    expect(result).toHaveLength(1)
    expect(result[0].flatName).toBe('A_0001_en.jpg')
  })
})

describe('extractCells with parentSuffix', () => {
  it('parentSuffixがファイル名とpathに付加される', () => {
    const cell1 = makeLayer({ name: '1' })
    const animFolder = makeAnimationFolder('A', [cell1])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    const result = extractCells(tree[0], DEFAULT_SETTINGS, 100, 100, EMPTY_CONTEXT, '_en')
    expect(result).toHaveLength(1)
    expect(result[0].flatName).toBe('A_0001_en.jpg')
    expect(result[0].path).toBe('A/A_0001_en.jpg')
  })

  it('parentSuffixをセル番号の前に挿入して出力できる', () => {
    const cell1 = makeLayer({ name: '1' })
    const animFolder = makeAnimationFolder('A', [cell1])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    const result = extractCells(
      tree[0], DEFAULT_SETTINGS, 100, 100, EMPTY_CONTEXT,
      '_en', undefined, 'white', [], 'before-cell',
    )
    expect(result).toHaveLength(1)
    expect(result[0].flatName).toBe('A_en_0001.jpg')
    expect(result[0].path).toBe('A/A_en_0001.jpg')
    expect(result[0].processSuffixes).toEqual(['_en'])
  })

  it('hierarchyFolder がフォルダ名とファイル名プレフィックスの両方に使われる (Q3 統一)', () => {
    // #1 対応: hierarchyFolder = displayName という設計。
    // ファイル名プレフィックスも同じ値になるため、"A_en" を渡すと
    // path = "A_en/A_en_0001_en.jpg" になる。parentSuffix は従来どおり末尾に付く。
    const cell1 = makeLayer({ name: '1' })
    const animFolder = makeAnimationFolder('A', [cell1])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    const result = extractCells(tree[0], DEFAULT_SETTINGS, 100, 100, EMPTY_CONTEXT, '_en', 'A_en')
    expect(result[0].path).toBe('A_en/A_en_0001_en.jpg')
    expect(result[0].flatName).toBe('A_en_0001_en.jpg')
  })

  it('parentSuffixと工程サフィックスが両方付加される', () => {
    const enFolder = makeFolder('EN', [makeLayer()])
    const cellFolder = makeFolder('A0001', [enFolder])
    const animFolder = makeAnimationFolder('A', [cellFolder])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    const settings = makeSettingsWithTable([{ suffix: '_en', folderNames: ['EN'] }])
    const result = extractCells(tree[0], settings, 100, 100, EMPTY_CONTEXT, '_layout', 'A_layout')
    const names = result.map(e => e.flatName).sort()
    // hierarchyFolder="A_layout" が displayName として使われる → プレフィックスも "A_layout"
    // 本体なし・工程のみ → "A_layout_0001_layout_en.jpg"
    expect(names).toContain('A_layout_0001_layout_en.jpg')
  })
})

describe('extractAllEntries', () => {
  it('ルート直下フォルダのprocessTable逆引きでparentSuffixが付加される', () => {
    const cell1 = makeLayer({ name: '1' })
    const animFolder = makeAnimationFolder('A', [cell1])
    const rootFolder = makeFolder('EN', [animFolder])
    const tree = buildLayerTree(makePsd({ children: [rootFolder] }))
    detectAnim(tree[0].children, 'A')

    const settings = makeSettingsWithTable([{ suffix: '_en', folderNames: ['EN'] }])
    const result = extractAllEntries(tree, settings, 100, 100)
    expect(result).toHaveLength(1)
    expect(result[0].flatName).toBe('A_0001_en.jpg')
  })

  it('extractAllEntriesでも工程名をセル番号の前に挿入できる', () => {
    const cell1 = makeLayer({ name: '1' })
    const animFolder = makeAnimationFolder('A', [cell1])
    const rootFolder = makeFolder('EN', [animFolder])
    const tree = buildLayerTree(makePsd({ children: [rootFolder] }))
    detectAnim(tree[0].children, 'A')

    const settings = makeSettingsWithTable([{ suffix: '_en', folderNames: ['EN'] }])
    const result = extractAllEntries(tree, settings, 100, 100, 'white', false, 'before-cell')
    expect(result).toHaveLength(1)
    expect(result[0].flatName).toBe('A_en_0001.jpg')
    expect(result[0].path).toBe('A/A_en_0001.jpg')
    expect(result[0].processSuffixes).toEqual(['_en'])
  })

  it('同名アニメフォルダは displayName の (n) で区別される', () => {
    // #1 対応: 同名 anim folder は "A", "A(2)" のように (n) でナンバリングされる。
    // 旧実装では flat name 衝突を "-2" で後付け解決していたが、新実装では
    // トラック/フォルダ識別を displayName レベルで行う。
    const cell1a = makeLayer({ name: '1' })
    const animA1 = makeAnimationFolder('A', [cell1a])
    const cell1b = makeLayer({ name: '1' })
    const animA2 = makeAnimationFolder('A', [cell1b])
    const root1 = makeFolder('演出工程', [animA1])
    const root2 = makeFolder('レイアウト', [animA2])
    const tree = buildLayerTree(makePsd({ children: [root2, root1] }))

    // XDTS で 2 トラック "A" を用意 → 両方 anim folder として割当される
    const xdts: XdtsData = {
      tracks: [
        { name: 'A', trackNo: 0, cellNames: [], frames: [] },
        { name: 'A', trackNo: 1, cellNames: [], frames: [] },
      ],
      version: 5, header: { cut: '1', scene: '1' }, timeTableName: 'タイムライン1', duration: 72, fps: 24,
    }
    detectAnimationFoldersByXdts(tree, xdts)

    const result = extractAllEntries(tree, DEFAULT_SETTINGS, 100, 100, 'white', false)
    const flatNames = result.map(e => e.flatName).sort()
    expect(flatNames).toContain('A_0001.jpg')
    expect(flatNames).toContain('A(2)_0001.jpg')
  })

  it('セル名出力でも同名アニメフォルダは displayName の (n) で区別される', () => {
    const cellA1 = makeLayer({ name: 'あ' })
    const animA1 = makeAnimationFolder('A', [cellA1])
    const cellA2 = makeLayer({ name: 'あ' })
    const animA2 = makeAnimationFolder('A', [cellA2])
    const tree = buildLayerTree(makePsd({ children: [animA1, animA2] }))

    const xdts: XdtsData = {
      tracks: [
        { name: 'A', trackNo: 0, cellNames: ['あ'], frames: [] },
        { name: 'A', trackNo: 1, cellNames: ['あ'], frames: [] },
      ],
      version: 5, header: { cut: '1', scene: '1' }, timeTableName: 'タイムライン1', duration: 72, fps: 24,
    }
    detectAnimationFoldersByXdts(tree, xdts)

    const result = extractAllEntries(tree, CELL_NAME_SETTINGS, 100, 100, 'white', false)
    const flatNames = result.map(e => e.flatName).sort()
    expect(flatNames).toContain('A_あ.jpg')
    expect(flatNames).toContain('A(2)_あ.jpg')
    expect(flatNames).not.toContain('A_あ_2.jpg')
  })

  it('同名アニメフォルダは parentSuffix が異なれば別 namespace で両方 "A" (process variants)', () => {
    // #1 対応(修正後): namespace = parentSuffix。
    // 同名でも parentSuffix が違えば process variants として別 namespace とみなし、
    // 両方とも base 名 "A" を displayName にして、parentSuffix で最終的に区別する。
    // (c001 の 作画/A と 演出/A のような実パターン)
    const cell1a = makeLayer({ name: '1' })
    const animA1 = makeAnimationFolder('A', [cell1a])
    const cell1b = makeLayer({ name: '1' })
    const animA2 = makeAnimationFolder('A', [cell1b])
    const root1 = makeFolder('EN', [animA1])
    const root2 = makeFolder('BG', [animA2])
    const tree = buildLayerTree(makePsd({ children: [root2, root1] }))

    const xdts: XdtsData = {
      tracks: [
        { name: 'A', trackNo: 0, cellNames: [], frames: [] },
        { name: 'A', trackNo: 1, cellNames: [], frames: [] },
      ],
      version: 5, header: { cut: '1', scene: '1' }, timeTableName: 'タイムライン1', duration: 72, fps: 24,
    }
    detectAnimationFoldersByXdts(tree, xdts)

    const settings = makeSettingsWithTable([
      { suffix: '_en', folderNames: ['EN'] },
      { suffix: '_bg', folderNames: ['BG'] },
    ])
    const result = extractAllEntries(tree, settings, 100, 100, 'white', false)
    const flatNames = result.map(e => e.flatName).sort()
    // namespace "_bg" と "_en" は別なので両方 "A"、parentSuffix で分岐
    expect(flatNames).toContain('A_0001_bg.jpg')
    expect(flatNames).toContain('A_0001_en.jpg')
    // (n) 連番は付かない(namespace が別)
    expect(flatNames).not.toContain('A(2)_0001_en.jpg')
    expect(flatNames).not.toContain('A(2)_0001_bg.jpg')
  })

  it('A と a は別トラックとして割当し、出力名でも区別する', () => {
    const animUpper = makeAnimationFolder('A', [makeLayer({ name: '1' })])
    const animLower = makeAnimationFolder('a', [makeLayer({ name: '1' })])
    const tree = buildLayerTree(makePsd({ children: [animUpper, animLower] }))

    const xdts: XdtsData = {
      tracks: [
        { name: 'A', trackNo: 0, cellNames: [], frames: [] },
        { name: 'a', trackNo: 1, cellNames: [], frames: [] },
      ],
      version: 5, header: { cut: '1', scene: '1' }, timeTableName: 'タイムライン1', duration: 72, fps: 24,
    }
    detectAnimationFoldersByXdts(tree, xdts)

    const result = extractAllEntries(tree, DEFAULT_SETTINGS, 100, 100, 'white', false)
    const flatNames = result.map(e => e.flatName).sort()
    expect(flatNames).toContain('A_0001.jpg')
    expect(flatNames).toContain('a(2)_0001.jpg')
  })

  it('同名アニメフォルダの階層フォルダ名は (n) で区別される', () => {
    // #1 対応: フォルダ名衝突は "-2" ではなく displayName の "(n)" で解決される
    const animA1 = makeAnimationFolder('A', [makeLayer({ name: '1' })])
    const animA2 = makeAnimationFolder('A', [makeLayer({ name: '1' })])
    const root1 = makeFolder('演出', [animA1])
    const root2 = makeFolder('レイアウト', [animA2])
    const tree = buildLayerTree(makePsd({ children: [root2, root1] }))

    const xdts: XdtsData = {
      tracks: [
        { name: 'A', trackNo: 0, cellNames: [], frames: [] },
        { name: 'A', trackNo: 1, cellNames: [], frames: [] },
      ],
      version: 5, header: { cut: '1', scene: '1' }, timeTableName: 'タイムライン1', duration: 72, fps: 24,
    }
    detectAnimationFoldersByXdts(tree, xdts)

    const result = extractAllEntries(tree, DEFAULT_SETTINGS, 100, 100, 'white', false)
    const paths = result.map(e => e.path)
    const folderNames = paths.map(p => p.split('/')[0]).sort()
    expect(folderNames).toContain('A')
    expect(folderNames).toContain('A(2)')
  })

  it('XDTS割当済みの同名解決を固定したまま手動アニメフォルダを後段に追加する', () => {
    const bottomA = makeFolder('A', [makeLayer({ name: '1' })])
    const topA = makeFolder('A', [makeLayer({ name: '1' })])
    const tree = buildLayerTree(makePsd({ children: [bottomA, topA] }))
    const xdts: XdtsData = {
      tracks: [{ name: 'A', trackNo: 0, cellNames: [], frames: [] }],
      version: 5, header: { cut: '1', scene: '1' }, timeTableName: 'タイムライン1', duration: 72, fps: 24,
    }
    detectAnimationFoldersByXdts(tree, xdts)

    const manualA = tree.find(layer => layer.originalName === 'A' && !layer.isAnimationFolder)
    expect(manualA).toBeDefined()
    markManualAnimFolder(manualA!)

    const result = extractAllEntries(tree, DEFAULT_SETTINGS, 100, 100, 'white', false)
    const flatNames = result.map(e => e.flatName).sort()
    expect(flatNames).toContain('A_0001.jpg')
    expect(flatNames).toContain('A(2)_0001.jpg')
  })

  it('セル名出力でもXDTS割当済みの同名解決を固定したまま手動アニメフォルダを後段に追加する', () => {
    const xdtsA = makeFolder('A', [makeLayer({ name: 'あ' })])
    const manualA = makeFolder('A', [makeLayer({ name: 'あ' })])
    const tree = buildLayerTree(makePsd({ children: [xdtsA, manualA] }))
    const xdts: XdtsData = {
      tracks: [{ name: 'A', trackNo: 0, cellNames: ['あ'], frames: [] }],
      version: 5, header: { cut: '1', scene: '1' }, timeTableName: 'タイムライン1', duration: 72, fps: 24,
    }
    detectAnimationFoldersByXdts(tree, xdts)

    const manualCandidate = tree.find(layer => layer.originalName === 'A' && !layer.isAnimationFolder)
    expect(manualCandidate).toBeDefined()
    markManualAnimFolder(manualCandidate!)

    const result = extractAllEntries(tree, CELL_NAME_SETTINGS, 100, 100, 'white', false)
    const flatNames = result.map(e => e.flatName).sort()
    expect(flatNames).toContain('A_あ.jpg')
    expect(flatNames).toContain('A(2)_あ.jpg')
    expect(flatNames).not.toContain('A_あ_2.jpg')
  })

  it('_付き手動アニメフォルダは単体マークではなくセルとして出力する', () => {
    const book = makeFolder('_BOOK1', [
      makeLayer({ name: '1' }),
      makeLayer({ name: '2' }),
    ])
    const root = makeFolder('_原図', [book])
    const tree = buildLayerTree(makePsd({ children: [root] }))
    const manualBook = tree[0].children.find(layer => layer.originalName === '_BOOK1')
    expect(manualBook).toBeDefined()
    markManualAnimFolder(manualBook!)

    const result = extractAllEntries(tree, DEFAULT_SETTINGS, 100, 100)
    const flatNames = result.map(e => e.flatName).sort()
    expect(flatNames).toContain('_BOOK1_0001.jpg')
    expect(flatNames).toContain('_BOOK1_0002.jpg')
    expect(flatNames).not.toContain('_BOOK1.jpg')
  })
})

/**
 * yc4_00_000_lo.psd + yc4_00_000_lo.xdts 相当のシナリオを合成して
 * #1 対応の end-to-end 挙動を検証する。
 *
 * 実 PSD 構造(ag-psd から確認済み):
 *   用紙
 *   _原図/レイヤー4
 *   LO
 *     TEST(bottom of LO)
 *       "A " (trailing space, bottom of bottom TEST) / 1 / 2
 *       "A" (top of bottom TEST) / 1 / 2
 *     TEST(top of LO)
 *       演出(サクラ)
 *       "A" (top of top TEST) / 4
 *   _TEST/A/レイヤー1
 *   フレーム ...
 *   メモ ...
 *
 * XDTS: names ["A ", "A", "A"] (trackNo 0/1/2)
 *
 * 期待:
 *   - anim folder 化: 3 つ(bottom TEST 内の "A " と "A"、top TEST 内の "A")
 *   - _TEST/A は割当されず通常フォルダのまま
 *   - displayName: "A", "A(2)", "A(3)" をボトム優先で割当
 *   - 警告なし(トラック 3 つとも割当成功)
 */
describe('#1 対応: yc4_00_000_lo シナリオの end-to-end', () => {
  function buildYc4Scenario() {
    // ag-psd はボトムファースト。makePsd で渡す順序もボトムファースト
    // (ただし makeFolder の children はそのまま渡す = 画面下が先頭)

    // bottom TEST (LO の中で画面下)
    const testBottom = makeFolder('TEST', [
      makeFolder('A ', [  // 末尾空白、画面下
        makeLayer({ name: '1' }),
        makeLayer({ name: '2' }),
      ]),
      makeFolder('A', [   // no space、画面上
        makeLayer({ name: '1' }),
        makeLayer({ name: '2' }),
      ]),
    ])

    // top TEST (LO の中で画面上)
    const testTop = makeFolder('TEST', [
      makeLayer({ name: '演出(サクラ)' }),
      makeFolder('A', [  // cell "4" 持ち
        makeLayer({ name: '4' }),
      ]),
    ])

    const lo = makeFolder('LO', [testBottom, testTop])

    // _TEST (余剰候補となるべき)
    const underTest = makeFolder('_TEST', [
      makeFolder('A', [
        makeLayer({ name: 'レイヤー 1' }),
      ]),
    ])

    // ag-psd はボトムファースト: _原図, lo, _TEST が順に積まれる
    // 画面表示では逆順(_TEST, LO, _原図)
    return makePsd({ children: [lo, underTest] })
  }

  function buildYc4Xdts(): XdtsData {
    return {
      tracks: [
        { name: 'A ', trackNo: 0, cellNames: [], frames: [] },  // 末尾空白
        { name: 'A', trackNo: 1, cellNames: [], frames: [] },
        { name: 'A', trackNo: 2, cellNames: [], frames: [] },
      ],
      version: 5,
      header: { cut: '1', scene: '1' },
      timeTableName: 'タイムライン1',
      duration: 144,
      fps: 24,
    }
  }

  it('全 3 トラックが anim folder に割当され、unmatchedTracks が空', () => {
    const psd = buildYc4Scenario()
    const tree = buildLayerTree(psd)
    const xdts = buildYc4Xdts()
    const result = detectAnimationFoldersByXdts(tree, xdts)

    expect(result.unmatchedTracks).toHaveLength(0)
    expect(result.assignment.size).toBe(3)
  })

  it('_TEST/A は anim folder にならず通常フォルダのまま残る', () => {
    const psd = buildYc4Scenario()
    const tree = buildLayerTree(psd)
    const xdts = buildYc4Xdts()
    detectAnimationFoldersByXdts(tree, xdts)

    // _TEST は tree のどこかにある。その中の A が anim folder 化されていないことを確認
    function findUnderTest(layers: typeof tree): typeof tree[number] | null {
      for (const l of layers) {
        if (l.originalName === '_TEST') return l
        const found = findUnderTest(l.children)
        if (found) return found
      }
      return null
    }
    const underTestFolder = findUnderTest(tree)
    expect(underTestFolder).not.toBeNull()
    const underTestA = underTestFolder!.children.find(c => c.originalName === 'A')
    expect(underTestA).toBeDefined()
    expect(underTestA!.isAnimationFolder).toBe(false)
  })

  it('displayName は A / A(2) / A(3) でボトム優先', () => {
    const psd = buildYc4Scenario()
    const tree = buildLayerTree(psd)
    const xdts = buildYc4Xdts()
    detectAnimationFoldersByXdts(tree, xdts)

    const result = extractAllEntries(tree, DEFAULT_SETTINGS, 100, 100, 'white', false)

    // 各 anim folder から 1-2 セルずつ出力される
    // bottom TEST/A  (末尾空白、cells 1,2) → "A" フォルダ
    // bottom TEST/A (no space、cells 1,2) → "A(2)" フォルダ
    // top TEST/A (cell 4) → "A(3)" フォルダ
    const folderNames = new Set(
      result
        .filter(e => e.path.includes('/'))  // 階層出力のみ
        .map(e => e.path.split('/')[0]),
    )
    expect(folderNames.has('A')).toBe(true)
    expect(folderNames.has('A(2)')).toBe(true)
    expect(folderNames.has('A(3)')).toBe(true)
  })

  it('末尾空白の "A " は trim されて displayName "A" として出力される', () => {
    const psd = buildYc4Scenario()
    const tree = buildLayerTree(psd)
    const xdts = buildYc4Xdts()
    detectAnimationFoldersByXdts(tree, xdts)

    const result = extractAllEntries(tree, DEFAULT_SETTINGS, 100, 100, 'white', false)

    // 末尾空白を含む path が出力に無いことを検証(Windows の命名制約回避)
    for (const entry of result) {
      expect(entry.path).not.toMatch(/^A \//)  // "A /" で始まらない
      expect(entry.flatName).not.toMatch(/^A _/) // "A _" で始まらない
    }
  })

  it('ボトム最下段 "A " のセル 2 枚は trackNo 0 対応で displayName "A" に紐づく', () => {
    const psd = buildYc4Scenario()
    const tree = buildLayerTree(psd)
    const xdts = buildYc4Xdts()
    detectAnimationFoldersByXdts(tree, xdts)

    const result = extractAllEntries(tree, DEFAULT_SETTINGS, 100, 100, 'white', false)

    const aEntries = result.filter(e => e.path.startsWith('A/'))
    expect(aEntries.length).toBe(2)  // cells 1, 2
  })

  it('top TEST の "A" (cell 4) は displayName "A(3)" の 1 セル出力', () => {
    const psd = buildYc4Scenario()
    const tree = buildLayerTree(psd)
    const xdts = buildYc4Xdts()
    detectAnimationFoldersByXdts(tree, xdts)

    const result = extractAllEntries(tree, DEFAULT_SETTINGS, 100, 100, 'white', false)

    const a3Entries = result.filter(e => e.path.startsWith('A(3)/'))
    expect(a3Entries.length).toBe(1)
  })
})

describe('extractMarkedLayers', () => {
  it('_プレフィックスフォルダをOutputEntryとして返す', () => {
    const psd = makePsd({ children: [makeFolder('_撮影指示', [makeLayer()])] })
    const tree = buildLayerTree(psd)
    const result = extractMarkedLayers(tree, 100, 100)
    expect(result).toHaveLength(1)
    expect(result[0].flatName).toBe('_撮影指示.jpg')
  })

  it('非表示レイヤーを除外する', () => {
    const psd = makePsd({ children: [makeFolder('_hidden', [], 'normal')] })
    const tree = buildLayerTree(psd)
    tree[0].uiHidden = true
    const result = extractMarkedLayers(tree, 100, 100)
    expect(result).toHaveLength(0)
  })
})

describe('extractAllEntries with auto-process promotion', () => {
  const SETTINGS_WITH_E: ProjectSettings = {
    processTable: [{ suffix: '_e', folderNames: ['_e', '演出'] }],
    cellNamingMode: 'sequence',
    archivePatterns: [],
  }

  it('昇格前: _BG1/{レイヤー, _e/} は autoMarked 単独出力される（本体のみの紙は出ない）', () => {
    const psd = makePsd({
      children: [
        makeFolder('_BG1', [
          makeLayer({ name: 'レイヤー 1 のコピー' }),
          makeFolder('_e', [makeLayer({ name: '修正' })]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd)
    const entries = extractAllEntries(tree, SETTINGS_WITH_E, 100, 100, 'white', false)
    const flatNames = entries.map(e => e.flatName).sort()
    // 昇格なしなので autoMarked 出力のみ。本体だけの紙（セル相当）は出ない。
    expect(flatNames).toContain('_BG1.jpg')
    expect(flatNames).toContain('_e.jpg')
    // アニメフォルダ由来のセル名（連番）は出ない
    expect(flatNames.some(n => /_BG1_\d{4}/.test(n))).toBe(false)
  })

  it('昇格後: _BG1 がアニメフォルダ化され、子レイヤー/フォルダが独立したセル紙として出る', () => {
    // extractCells は各子を独立セルとして扱う仕様。工程フォルダ suffix は
    // 「セルフォルダの中にある工程フォルダ」にしか発動しない（アニメフォルダ直下の
    // フォルダはそれ自体がセル）。したがって昇格後の _e/ は「演出差分のセル」、
    // レイヤーは「本体セル」として独立出力される。
    const psd = makePsd({
      children: [
        makeFolder('_BG1', [
          makeLayer({ name: 'レイヤー 1 のコピー' }),
          makeFolder('_e', [makeLayer({ name: '修正' })]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd)
    const promoted = promoteAutoMarkedByProcessMatch(tree, SETTINGS_WITH_E.processTable)
    const entries = extractAllEntries(promoted, SETTINGS_WITH_E, 100, 100, 'white', false)
    const flatNames = entries.map(e => e.flatName).sort()
    // 昇格後は _BG1 単独の autoMarked 出力は出ない（アニメフォルダに昇格したので）
    expect(flatNames).not.toContain('_BG1.jpg')
    // 配下の _e 単独 autoMarked 出力も出ない（親がアニメフォルダなので context 内セル扱い）
    expect(flatNames).not.toContain('_e.jpg')
    // _BG1_ プレフィックスのセル出力が 2 つ出る（本体レイヤー + _e フォルダの 2 子）
    const bg1Cells = flatNames.filter(n => n.startsWith('_BG1_'))
    expect(bg1Cells.length).toBe(2)
  })

  it('内側優先: パターンC で内側 _BG1 のみ昇格、外側 _原図 は autoMarked 据え置き', () => {
    const psd = makePsd({
      children: [
        makeFolder('_原図', [
          makeFolder('_e', [makeLayer({ name: '全体修正' })]),
          makeFolder('_BG1', [
            makeLayer({ name: 'レイヤー' }),
            makeFolder('_e', [makeLayer({ name: 'BG1修正' })]),
          ]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd)
    const promoted = promoteAutoMarkedByProcessMatch(tree, SETTINGS_WITH_E.processTable)
    const entries = extractAllEntries(promoted, SETTINGS_WITH_E, 100, 100, 'white', false)
    const flatNames = entries.map(e => e.flatName).sort()
    // _原図 は据え置きなので _原図.jpg が出る
    expect(flatNames).toContain('_原図.jpg')
    // _BG1 は昇格してセル出力が 2 つ（本体 + _e フォルダのセル）
    const bg1Cells = flatNames.filter(n => n.startsWith('_BG1_'))
    expect(bg1Cells.length).toBe(2)
    // 内側 _e は _BG1 の中のセル扱い、外側 _原図/_e は _原図 の autoMarked 出力に巻き込まれる
    // （独立 _e.jpg が 1 つだけ衝突回避付きで出る可能性あり、但しパターンC は実務上発生しない想定）
  })

  it('autoProcess 昇格フォルダのセル名は `_` 除去済み name（sequence モードでも）', () => {
    // autoProcess 昇格では子フォルダ名が素材分類の意味を持つ。sequence 連番では
    // 情報消失するため、cellLabel は常に `_` 除去済み name を使う。
    const psd = makePsd({
      children: [
        makeFolder('_原図', [
          makeFolder('_BOOK1', [makeLayer({ name: 'book1' })]),
          makeFolder('_BG', [makeLayer({ name: 'bg1' })]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd)
    // _BG を processTable に追加して _原図 を昇格させる
    const settings: ProjectSettings = {
      processTable: [{ suffix: '_bg', folderNames: ['_BG'] }],
      cellNamingMode: 'sequence',
      archivePatterns: [],
    }
    const promoted = promoteAutoMarkedByProcessMatch(tree, settings.processTable)
    const entries = extractAllEntries(promoted, settings, 100, 100, 'white', false)
    const flatNames = entries.map(e => e.flatName).sort()
    // 連番 _0001 / _0002 ではなく、子フォルダ名（`_` 除去）が反映される
    expect(flatNames).toContain('_原図_BOOK1.jpg')
    expect(flatNames).toContain('_原図_BG.jpg')
    // 連番表記は出ない
    expect(flatNames.some(n => /_\d{4}\.jpg$/.test(n))).toBe(false)
  })

  it('通常アニメフォルダ（非 autoProcess）では従来通り sequence 連番が使われる', () => {
    const psd = makePsd({
      children: [
        makeAnimationFolder('A', [
          makeFolder('1', [makeLayer()]),
          makeFolder('2', [makeLayer()]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd)
    markManualAnimFolder(tree[0])
    const entries = extractAllEntries(tree, DEFAULT_SETTINGS, 100, 100, 'white', false)
    const flatNames = entries.map(e => e.flatName).sort()
    expect(flatNames).toContain('A_0001.jpg')
    expect(flatNames).toContain('A_0002.jpg')
  })

  it('processTable 空の場合は昇格せず autoMarked 出力のまま', () => {
    const psd = makePsd({
      children: [
        makeFolder('_BG1', [
          makeLayer({ name: 'レイヤー' }),
          makeFolder('_e', [makeLayer({ name: '修正' })]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd)
    const promoted = promoteAutoMarkedByProcessMatch(tree, [])
    const entries = extractAllEntries(promoted, DEFAULT_SETTINGS, 100, 100, 'white', false)
    const flatNames = entries.map(e => e.flatName).sort()
    expect(flatNames).toContain('_BG1.jpg')
    expect(flatNames).toContain('_e.jpg')
  })
})
