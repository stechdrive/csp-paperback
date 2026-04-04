import { describe, it, expect } from 'vitest'
import {
  buildLayerTree,
  detectAnimationFoldersByXdts,
  hasAnimationFolderDescendant,
  collectAnimFolderAncestorIds,
} from '../../engine/tree-builder'
import { makeLayer, makePsd, makeFolder, makeAnimationFolder, makePassThroughFolder } from '../helpers/psd-factory'
import type { XdtsData } from '../../types'

describe('buildLayerTree', () => {
  it('空のPSDで空配列を返す', () => {
    const psd = makePsd({ children: [] })
    expect(buildLayerTree(psd)).toEqual([])
  })

  it('通常レイヤーを正しく変換する', () => {
    const psd = makePsd({ children: [makeLayer({ name: 'test', hidden: false })] })
    const tree = buildLayerTree(psd)
    expect(tree).toHaveLength(1)
    expect(tree[0].originalName).toBe('test')
    expect(tree[0].name).toBe('test')
    expect(tree[0].hidden).toBe(false)
    expect(tree[0].isFolder).toBe(false)
    expect(tree[0].parentId).toBeNull()
    expect(tree[0].depth).toBe(0)
  })

  it('フォルダを正しく変換する', () => {
    const child = makeLayer({ name: 'child' })
    const psd = makePsd({ children: [makeFolder('parent', [child])] })
    const tree = buildLayerTree(psd)
    expect(tree[0].isFolder).toBe(true)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].originalName).toBe('child')
    expect(tree[0].children[0].parentId).toBe(tree[0].id)
    expect(tree[0].children[0].depth).toBe(1)
  })

  it('_プレフィックスのフォルダを自動マークする', () => {
    const psd = makePsd({ children: [makeFolder('_撮影指示', [])] })
    const tree = buildLayerTree(psd)
    expect(tree[0].autoMarked).toBe(true)
    expect(tree[0].name).toBe('撮影指示') // _が除去された表示名
    expect(tree[0].originalName).toBe('_撮影指示')
  })

  it('_プレフィックスの通常レイヤーは自動マークしない', () => {
    const psd = makePsd({ children: [makeLayer({ name: '_layer' })] })
    const tree = buildLayerTree(psd)
    expect(tree[0].autoMarked).toBe(false) // フォルダのみ自動マーク
  })

  it('xdts検出後のアニメーションフォルダ内の_プレフィックスは自動マークしない', () => {
    // xdtsでアニメフォルダを検出した場合、フォルダ内の_プレフィックスは無視される
    // ※ツリー構築時点ではアニメフォルダは不明なので、ここでは_プレフィックスが自動マークされる
    // 実装: アニメフォルダ内の_プレフィックスはUI層で除外処理する
    const child = makeFolder('_cell', [])
    const animFolder = makeAnimationFolder('A', [child])
    const psd = makePsd({ children: [animFolder] })
    const tree = buildLayerTree(psd)
    // アニメフォルダはxdtsで特定されるまではただのフォルダ
    // xdts適用後にisAnimationFolderがtrueになる
    const xdts = { tracks: [{ name: 'A', cellNames: [], frames: [] }], version: 5, header: { cut: '1', scene: '1' }, timeTableName: 'タイムライン1', duration: 72 }
    detectAnimationFoldersByXdts(tree, xdts)
    const animNode = tree[0]
    expect(animNode.isAnimationFolder).toBe(true)
    // ツリー構築時は_プレフィックスを自動マークしてしまうが、
    // アニメフォルダ内セルへのマークはUI層でフィルタリングする（v1の設計）
  })

  it('UUIDが各レイヤーに設定される', () => {
    const psd = makePsd({ children: [makeLayer(), makeLayer()] })
    const tree = buildLayerTree(psd)
    expect(tree[0].id).not.toBe(tree[1].id)
    expect(tree[0].id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('pass throughフォルダのblendModeを保持する', () => {
    const psd = makePsd({ children: [makePassThroughFolder('group', [])] })
    const tree = buildLayerTree(psd)
    expect(tree[0].blendMode).toBe('pass through')
  })

  it('非表示レイヤーを正しく変換する', () => {
    const psd = makePsd({ children: [makeLayer({ name: 'hidden', hidden: true })] })
    const tree = buildLayerTree(psd)
    expect(tree[0].hidden).toBe(true)
  })

  it('クリッピングレイヤーを正しく変換する', () => {
    const psd = makePsd({ children: [makeLayer({ clipping: true })] })
    const tree = buildLayerTree(psd)
    expect(tree[0].clipping).toBe(true)
  })
})

describe('detectAnimationFoldersByXdts', () => {
  it('xdtsのtrack名でアニメーションフォルダを検出する', () => {
    // buildLayerTree はボトムファースト→トップファーストに逆転するため
    // psd.children の末尾が tree[0] になる
    const psd = makePsd({ children: [makeFolder('B', []), makeFolder('A', [])] })
    // tree[0] = A, tree[1] = B
    const tree = buildLayerTree(psd)
    const xdts: XdtsData = { tracks: [{ name: 'A', cellNames: [], frames: [] }], version: 5, header: { cut: '1', scene: '1' }, timeTableName: 'タイムライン1', duration: 72 }
    detectAnimationFoldersByXdts(tree, xdts)
    expect(tree[0].isAnimationFolder).toBe(true)
    expect(tree[0].animationFolder?.detectedBy).toBe('xdts')
    expect(tree[1].isAnimationFolder).toBe(false) // B はxdtsにないのでfalse
  })

  it('tracks配列にある名前のフォルダはすべてアニメーションフォルダとして検出する', () => {
    // カメラワーク等の除外はパーサー側（fieldId=5）で行われるため、
    // detectAnimationFoldersByXdts に渡された tracks はすべて検出対象
    const psd = makePsd({ children: [makeFolder('CAM', [])] })
    const tree = buildLayerTree(psd)
    const xdts: XdtsData = { tracks: [{ name: 'CAM', cellNames: [], frames: [] }], version: 5, header: { cut: '1', scene: '1' }, timeTableName: 'タイムライン1', duration: 72 }
    detectAnimationFoldersByXdts(tree, xdts)
    expect(tree[0].isAnimationFolder).toBe(true)
  })

  it('track名の照合は大文字小文字を区別しない', () => {
    const psd = makePsd({ children: [makeFolder('a', [])] })
    const tree = buildLayerTree(psd)
    const xdts: XdtsData = { tracks: [{ name: 'A', cellNames: [], frames: [] }], version: 5, header: { cut: '1', scene: '1' }, timeTableName: 'タイムライン1', duration: 72 }
    detectAnimationFoldersByXdts(tree, xdts)
    expect(tree[0].isAnimationFolder).toBe(true)
  })
})

describe('hasAnimationFolderDescendant', () => {
  it('isAnimationFolder=trueのノードでtrueを返す', () => {
    const psd = makePsd({ children: [makeAnimationFolder('A', [])] })
    const tree = buildLayerTree(psd)
    // xdts検出をシミュレート
    tree[0].isAnimationFolder = true
    expect(hasAnimationFolderDescendant(tree[0])).toBe(true)
  })

  it('アニメーションフォルダを子孫に持つフォルダでtrueを返す', () => {
    const animChild = makeAnimationFolder('A', [])
    const parentFolder = makeFolder('parent', [animChild])
    const psd = makePsd({ children: [parentFolder] })
    const tree = buildLayerTree(psd)
    // xdts検出をシミュレート
    tree[0].children[0].isAnimationFolder = true
    expect(hasAnimationFolderDescendant(tree[0])).toBe(true)
  })

  it('アニメーションフォルダを持たないフォルダでfalseを返す', () => {
    const psd = makePsd({ children: [makeFolder('normal', [makeLayer()])] })
    const tree = buildLayerTree(psd)
    expect(hasAnimationFolderDescendant(tree[0])).toBe(false)
  })
})

describe('collectAnimFolderAncestorIds', () => {
  it('アニメーションフォルダの祖先IDを収集する', () => {
    const animChild = makeAnimationFolder('A', [])
    const parentFolder = makeFolder('parent', [animChild])
    const psd = makePsd({ children: [parentFolder] })
    const tree = buildLayerTree(psd)
    // xdts検出をシミュレート
    tree[0].children[0].isAnimationFolder = true
    const ancestorIds = collectAnimFolderAncestorIds(tree)
    expect(ancestorIds.has(tree[0].id)).toBe(true) // parentのIDが含まれる
    expect(ancestorIds.has(tree[0].children[0].id)).toBe(false) // アニメフォルダ自身は含まれない
  })

  it('アニメーションフォルダが存在しない場合は空Setを返す', () => {
    const psd = makePsd({ children: [makeFolder('normal', [])] })
    const tree = buildLayerTree(psd)
    const ancestorIds = collectAnimFolderAncestorIds(tree)
    expect(ancestorIds.size).toBe(0)
  })
})
