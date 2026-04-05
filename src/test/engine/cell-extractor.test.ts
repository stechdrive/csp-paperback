import { describe, it, expect } from 'vitest'
import { extractCells, extractMarkedLayers, extractAllEntries } from '../../engine/cell-extractor'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { makeLayer, makePsd, makeFolder, makeAnimationFolder } from '../helpers/psd-factory'
import type { ProjectSettings, XdtsData, FlatLayer } from '../../types'

const DEFAULT_SETTINGS: ProjectSettings = {
  processTable: [],
  cellNamingMode: 'sequence',
}

const EMPTY_CONTEXT: FlatLayer[] = []

function makeSettingsWithTable(entries: { suffix: string; folderNames: string[] }[]): ProjectSettings {
  return { processTable: entries, cellNamingMode: 'sequence' }
}

function detectAnim(tree: ReturnType<typeof buildLayerTree>, trackName: string) {
  const xdts: XdtsData = { tracks: [{ name: trackName, cellNames: [], frames: [] }], version: 5, header: { cut: '1', scene: '1' }, timeTableName: 'タイムライン1', duration: 72 }
  detectAnimationFoldersByXdts(tree, xdts)
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

  it('hierarchyFolderがpathのフォルダ名として使われる', () => {
    const cell1 = makeLayer({ name: '1' })
    const animFolder = makeAnimationFolder('A', [cell1])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    detectAnim(tree, 'A')

    const result = extractCells(tree[0], DEFAULT_SETTINGS, 100, 100, EMPTY_CONTEXT, '_en', 'A_en')
    expect(result[0].path).toBe('A_en/A_0001_en.jpg')
    expect(result[0].flatName).toBe('A_0001_en.jpg')
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
    // 本体なし・工程のみ → A_0001_layout_en.jpg
    expect(names).toContain('A_0001_layout_en.jpg')
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

  it('同名アニメフォルダが異なる親コンテナにある場合にフラット名衝突を解決する', () => {
    const cell1a = makeLayer({ name: '1' })
    const animA1 = makeAnimationFolder('A', [cell1a])
    const cell1b = makeLayer({ name: '1' })
    const animA2 = makeAnimationFolder('A', [cell1b])
    // 両方のルートフォルダはprocessTableにマッチしない
    const root1 = makeFolder('演出工程', [animA1])
    const root2 = makeFolder('レイアウト', [animA2])
    const tree = buildLayerTree(makePsd({ children: [root2, root1] }))
    // root1 が tree[0] (reversed), root2 が tree[1]
    detectAnimInTree(tree, 'A')

    const result = extractAllEntries(tree, DEFAULT_SETTINGS, 100, 100)
    const flatNames = result.map(e => e.flatName).sort()
    // 衝突 → 一方が A_0001.jpg、他方が A_0001-2.jpg
    expect(flatNames).toContain('A_0001.jpg')
    expect(flatNames).toContain('A_0001-2.jpg')
  })

  it('同名アニメフォルダが異なるparentSuffixで区別される場合は衝突しない', () => {
    const cell1a = makeLayer({ name: '1' })
    const animA1 = makeAnimationFolder('A', [cell1a])
    const cell1b = makeLayer({ name: '1' })
    const animA2 = makeAnimationFolder('A', [cell1b])
    const root1 = makeFolder('EN', [animA1])
    const root2 = makeFolder('BG', [animA2])
    const tree = buildLayerTree(makePsd({ children: [root2, root1] }))
    detectAnimInTree(tree, 'A')

    const settings = makeSettingsWithTable([
      { suffix: '_en', folderNames: ['EN'] },
      { suffix: '_bg', folderNames: ['BG'] },
    ])
    const result = extractAllEntries(tree, settings, 100, 100)
    const flatNames = result.map(e => e.flatName).sort()
    expect(flatNames).toContain('A_0001_en.jpg')
    expect(flatNames).toContain('A_0001_bg.jpg')
  })

  it('階層フォルダ名の衝突が -2 で解決される', () => {
    const animA1 = makeAnimationFolder('A', [makeLayer({ name: '1' })])
    const animA2 = makeAnimationFolder('A', [makeLayer({ name: '1' })])
    const root1 = makeFolder('演出', [animA1])
    const root2 = makeFolder('レイアウト', [animA2])
    const tree = buildLayerTree(makePsd({ children: [root2, root1] }))
    detectAnimInTree(tree, 'A')

    const result = extractAllEntries(tree, DEFAULT_SETTINGS, 100, 100)
    const paths = result.map(e => e.path)
    const folderNames = paths.map(p => p.split('/')[0]).sort()
    expect(folderNames).toContain('A')
    expect(folderNames).toContain('A-2')
  })
})

function detectAnimInTree(layers: ReturnType<typeof buildLayerTree>, trackName: string) {
  const xdts: XdtsData = { tracks: [{ name: trackName, cellNames: [], frames: [] }], version: 5, header: { cut: '1', scene: '1' }, timeTableName: 'タイムライン1', duration: 72 }
  detectAnimationFoldersByXdts(layers, xdts)
  for (const layer of layers) {
    if (layer.isFolder && !layer.isAnimationFolder) {
      detectAnimInTree(layer.children, trackName)
    }
  }
}

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
