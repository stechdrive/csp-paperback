import { describe, it, expect } from 'vitest'
import { flattenTree, compositeRoot, flattenToCanvas } from '../../engine/flatten'
import { buildLayerTree } from '../../engine/tree-builder'
import {
  makeLayer,
  makePsd,
  makeFolder,
  makeAnimationFolder,
  makePassThroughFolder,
  makeCanvas,
} from '../helpers/psd-factory'

describe('flattenTree', () => {
  it('空のツリーで空配列を返す', () => {
    const tree = buildLayerTree(makePsd({ children: [] }))
    expect(flattenTree(tree, 100, 100)).toEqual([])
  })

  it('非表示レイヤーを除外する', () => {
    const psd = makePsd({ children: [
      makeLayer({ name: 'visible', hidden: false }),
      makeLayer({ name: 'hidden', hidden: true }),
    ]})
    const tree = buildLayerTree(psd)
    const flat = flattenTree(tree, 100, 100)
    expect(flat).toHaveLength(1)
    expect(flat[0].sourceId).toBe(tree[0].id)
  })

  it('uiHiddenレイヤーを除外する', () => {
    const psd = makePsd({ children: [makeLayer({ name: 'layer' })] })
    const tree = buildLayerTree(psd)
    tree[0].uiHidden = true
    const flat = flattenTree(tree, 100, 100)
    expect(flat).toHaveLength(0)
  })

  it('通常レイヤーをそのままFlatLayerに変換する', () => {
    const canvas = makeCanvas()
    const psd = makePsd({ children: [makeLayer({ name: 'layer', blendMode: 'multiply', top: 10, left: 20, canvas })] })
    const tree = buildLayerTree(psd)
    const flat = flattenTree(tree, 100, 100)
    expect(flat).toHaveLength(1)
    expect(flat[0].blendMode).toBe('multiply')
    expect(flat[0].top).toBe(10)
    expect(flat[0].left).toBe(20)
    expect(flat[0].canvas).toBe(canvas)
  })

  it('Pass Throughフォルダは子をそのまま展開する', () => {
    const child1 = makeLayer({ name: 'c1', blendMode: 'multiply' })
    const child2 = makeLayer({ name: 'c2', blendMode: 'screen' })
    const folder = makePassThroughFolder('group', [child1, child2])
    const tree = buildLayerTree(makePsd({ children: [folder] }))
    const flat = flattenTree(tree, 100, 100)
    // 2枚が展開されて返る（フォルダは消える）
    expect(flat).toHaveLength(2)
    expect(flat[0].blendMode).toBe('multiply')
    expect(flat[1].blendMode).toBe('screen')
  })

  it('非Pass Throughフォルダは子を合成して1枚にする', () => {
    const child1 = makeLayer({ name: 'c1' })
    const child2 = makeLayer({ name: 'c2' })
    const folder = makeFolder('group', [child1, child2], 'multiply')
    const tree = buildLayerTree(makePsd({ children: [folder] }))
    const flat = flattenTree(tree, 100, 100)
    // 1枚に合成されてフォルダのblendModeで返る
    expect(flat).toHaveLength(1)
    expect(flat[0].blendMode).toBe('multiply')
    expect(flat[0].sourceId).toBe(tree[0].id)
  })

  it('空フォルダは空配列を返す', () => {
    const folder = makeFolder('empty', [])
    const tree = buildLayerTree(makePsd({ children: [folder] }))
    const flat = flattenTree(tree, 100, 100)
    expect(flat).toHaveLength(0)
  })

  it('アニメーションフォルダを含む親フォルダは例外ルール（子を個別に展開）', () => {
    // 構造: parentFolder → [normalLayer, animFolder]
    const normalLayer = makeLayer({ name: 'normal', blendMode: 'multiply' })
    const animFolder = makeAnimationFolder('A', [makeLayer({ name: 'cell1' })])
    const parentFolder = makePassThroughFolder('parent', [normalLayer, animFolder])
    const tree = buildLayerTree(makePsd({ children: [parentFolder] }))
    // xdts照合でアニメフォルダを設定（実際の使用時と同様）
    const animNode = tree[0].children[1]
    animNode.isAnimationFolder = true
    animNode.animationFolder = { mode: 'cell-inclusive', detectedBy: 'xdts', trackName: 'A' }
    const flat = flattenTree(tree, 100, 100)
    // parentFolderは例外ルールで合成されず、子が個別に返る
    // normalLayer + animFolderの1セル = 2枚
    expect(flat).toHaveLength(2)
  })

  it('アニメーションフォルダはプレビュー用に最初のセルを合成する', () => {
    const cell1 = makeLayer({ name: 'cell1' })
    const cell2 = makeLayer({ name: 'cell2' })
    const animFolder = makeAnimationFolder('A', [cell1, cell2])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    // アニメフォルダとして手動設定
    tree[0].isAnimationFolder = true
    tree[0].animationFolder = { mode: 'cell-inclusive', detectedBy: 'manual', trackName: 'A' }
    const flat = flattenTree(tree, 100, 100)
    expect(flat).toHaveLength(1)
    expect(flat[0].sourceId).toBe(tree[0].id)
  })

  it('アニメーションフォルダのセル選択インデックスを尊重する', () => {
    const cell1 = makeLayer({ name: 'cell1' })
    const cell2 = makeLayer({ name: 'cell2' })
    const animFolder = makeAnimationFolder('A', [cell1, cell2])
    const tree = buildLayerTree(makePsd({ children: [animFolder] }))
    tree[0].isAnimationFolder = true
    tree[0].animationFolder = { mode: 'cell-inclusive', detectedBy: 'manual', trackName: 'A' }
    const animId = tree[0].id
    const selectedCells = new Map([[animId, 1]])
    const flat = flattenTree(tree, 100, 100, selectedCells)
    expect(flat).toHaveLength(1)
  })

  it('非表示の子を持つPass Throughフォルダは空配列を返す', () => {
    const child = makeLayer({ name: 'hidden', hidden: true })
    const folder = makePassThroughFolder('group', [child])
    const tree = buildLayerTree(makePsd({ children: [folder] }))
    const flat = flattenTree(tree, 100, 100)
    expect(flat).toHaveLength(0)
  })
})

describe('compositeRoot', () => {
  it('空のフラットレイヤーで指定サイズのキャンバスを返す', () => {
    const result = compositeRoot([], 200, 150, 'white')
    expect(result.width).toBe(200)
    expect(result.height).toBe(150)
  })

  it('白背景モードでキャンバスを生成する', () => {
    const result = compositeRoot([], 100, 100, 'white')
    expect(result).toBeDefined()
  })

  it('透過背景モードでキャンバスを生成する', () => {
    const result = compositeRoot([], 100, 100, 'transparent')
    expect(result).toBeDefined()
  })
})

describe('flattenToCanvas', () => {
  it('レイヤーツリーを1枚のキャンバスに合成する', () => {
    const psd = makePsd({ width: 200, height: 150, children: [makeLayer()] })
    const tree = buildLayerTree(psd)
    const canvas = flattenToCanvas(tree, 200, 150)
    expect(canvas.width).toBe(200)
    expect(canvas.height).toBe(150)
  })
})
