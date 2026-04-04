import { describe, it, expect } from 'vitest'
import { extractCells, extractMarkedLayers } from '../../engine/cell-extractor'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { makeLayer, makePsd, makeFolder, makeAnimationFolder } from '../helpers/psd-factory'
import type { ProjectSettings, XdtsData, FlatLayer } from '../../types'

const DEFAULT_SETTINGS: ProjectSettings = {
  processTable: [],
  sequenceDigits: 4,
  defaultMode: 'cell-inclusive',
}

const EMPTY_CONTEXT: FlatLayer[] = []

function makeSettingsWithTable(entries: { suffix: string; folderNames: string[] }[]): ProjectSettings {
  return { ...DEFAULT_SETTINGS, processTable: entries }
}

describe('extractCells - 通常モード', () => {
  it('アニメフォルダでない場合は空配列を返す', () => {
    const psd = makePsd({ children: [makeFolder('A', [])] })
    const tree = buildLayerTree(psd)
    const result = extractCells(tree[0], DEFAULT_SETTINGS, 100, 100, EMPTY_CONTEXT)
    expect(result).toHaveLength(0)
  })

  it('通常モードで各セルを連番ファイル名で出力する', () => {
    const cell1 = makeLayer({ name: 'frame1' })
    const cell2 = makeLayer({ name: 'frame2' })
    const animFolder = makeAnimationFolder('A', [cell1, cell2])
    const psd = makePsd({ children: [animFolder] })
    const tree = buildLayerTree(psd)
    const xdts: XdtsData = { tracks: [{ name: 'A', isCam: false }] }
    detectAnimationFoldersByXdts(tree, xdts)
    tree[0].animationFolder!.mode = 'normal'

    const result = extractCells(tree[0], DEFAULT_SETTINGS, 100, 100, EMPTY_CONTEXT)
    expect(result).toHaveLength(2)
    expect(result[0].flatName).toBe('A_0001.jpg')
    expect(result[1].flatName).toBe('A_0002.jpg')
    expect(result[0].path).toBe('A/A_0001.jpg')
  })

  it('連番桁数設定を尊重する', () => {
    const cell1 = makeLayer({ name: 'c1' })
    const animFolder = makeAnimationFolder('B', [cell1])
    const psd = makePsd({ children: [animFolder] })
    const tree = buildLayerTree(psd)
    const xdts: XdtsData = { tracks: [{ name: 'B', isCam: false }] }
    detectAnimationFoldersByXdts(tree, xdts)
    tree[0].animationFolder!.mode = 'normal'

    const settings = { ...DEFAULT_SETTINGS, sequenceDigits: 3 }
    const result = extractCells(tree[0], settings, 100, 100, EMPTY_CONTEXT)
    expect(result[0].flatName).toBe('B_001.jpg')
  })

  it('非表示セルを除外する', () => {
    const cell1 = makeLayer({ name: 'c1', hidden: false })
    const cell2 = makeLayer({ name: 'c2', hidden: true })
    const animFolder = makeAnimationFolder('A', [cell1, cell2])
    const psd = makePsd({ children: [animFolder] })
    const tree = buildLayerTree(psd)
    const xdts: XdtsData = { tracks: [{ name: 'A', isCam: false }] }
    detectAnimationFoldersByXdts(tree, xdts)
    tree[0].animationFolder!.mode = 'normal'

    const result = extractCells(tree[0], DEFAULT_SETTINGS, 100, 100, EMPTY_CONTEXT)
    expect(result).toHaveLength(1)
    expect(result[0].flatName).toBe('A_0001.jpg')
  })
})

describe('extractCells - セル内包型モード', () => {
  it('processTableにマッチするフォルダを独立出力する', () => {
    const enFolder = makeFolder('EN', [makeLayer({ name: 'line' })])
    const bodyLayer = makeLayer({ name: 'A0001' })
    const cellFolder = makeFolder('A0001', [enFolder, bodyLayer])
    const animFolder = makeAnimationFolder('A', [cellFolder])
    const psd = makePsd({ children: [animFolder] })
    const tree = buildLayerTree(psd)
    const xdts: XdtsData = { tracks: [{ name: 'A', isCam: false }] }
    detectAnimationFoldersByXdts(tree, xdts)
    // cell-inclusiveモード（デフォルト）

    const settings = makeSettingsWithTable([{ suffix: '_en', folderNames: ['EN', '演出修正'] }])
    const result = extractCells(tree[0], settings, 100, 100, EMPTY_CONTEXT)

    // A0001.jpg（本体）と A0001_en.jpg（工程）の2枚
    expect(result).toHaveLength(2)
    const names = result.map(e => e.flatName).sort()
    expect(names).toContain('A0001.jpg')
    expect(names).toContain('A0001_en.jpg')
  })

  it('processTableに未登録のフォルダはセル本体として合成する', () => {
    const unknownFolder = makeFolder('UNKNOWN', [makeLayer()])
    const cellFolder = makeFolder('A0001', [unknownFolder])
    const animFolder = makeAnimationFolder('A', [cellFolder])
    const psd = makePsd({ children: [animFolder] })
    const tree = buildLayerTree(psd)
    const xdts: XdtsData = { tracks: [{ name: 'A', isCam: false }] }
    detectAnimationFoldersByXdts(tree, xdts)

    const settings = makeSettingsWithTable([{ suffix: '_en', folderNames: ['EN'] }])
    const result = extractCells(tree[0], settings, 100, 100, EMPTY_CONTEXT)

    // 本体のみ1枚
    expect(result).toHaveLength(1)
    expect(result[0].flatName).toBe('A0001.jpg')
  })

  it('フォルダ名照合は大文字小文字を区別しない', () => {
    const enFolder = makeFolder('en', [makeLayer()])
    const cellFolder = makeFolder('A0001', [enFolder])
    const animFolder = makeAnimationFolder('A', [cellFolder])
    const psd = makePsd({ children: [animFolder] })
    const tree = buildLayerTree(psd)
    const xdts: XdtsData = { tracks: [{ name: 'A', isCam: false }] }
    detectAnimationFoldersByXdts(tree, xdts)

    const settings = makeSettingsWithTable([{ suffix: '_en', folderNames: ['EN'] }])
    const result = extractCells(tree[0], settings, 100, 100, EMPTY_CONTEXT)
    expect(result.map(e => e.flatName)).toContain('A0001_en.jpg')
  })

  it('セルフォルダに本体レイヤーがない場合は本体出力しない', () => {
    const enFolder = makeFolder('EN', [makeLayer()])
    // 本体なし（工程フォルダのみ）
    const cellFolder = makeFolder('A0001', [enFolder])
    const animFolder = makeAnimationFolder('A', [cellFolder])
    const psd = makePsd({ children: [animFolder] })
    const tree = buildLayerTree(psd)
    const xdts: XdtsData = { tracks: [{ name: 'A', isCam: false }] }
    detectAnimationFoldersByXdts(tree, xdts)

    const settings = makeSettingsWithTable([{ suffix: '_en', folderNames: ['EN'] }])
    const result = extractCells(tree[0], settings, 100, 100, EMPTY_CONTEXT)
    // 工程のみ
    expect(result).toHaveLength(1)
    expect(result[0].flatName).toBe('A0001_en.jpg')
  })
})

describe('extractMarkedLayers', () => {
  it('_プレフィックスフォルダをOutputEntryとして返す', () => {
    const psd = makePsd({ children: [makeFolder('_撮影指示', [makeLayer()])] })
    const tree = buildLayerTree(psd)
    // autoMarkedはbuildLayerTreeで設定済み
    const result = extractMarkedLayers(tree, 100, 100)
    expect(result).toHaveLength(1)
    expect(result[0].flatName).toBe('撮影指示.jpg') // _除去後
  })

  it('非表示レイヤーを除外する', () => {
    const psd = makePsd({ children: [makeFolder('_hidden', [], 'normal')] })
    const tree = buildLayerTree(psd)
    tree[0].uiHidden = true
    const result = extractMarkedLayers(tree, 100, 100)
    expect(result).toHaveLength(0)
  })
})
