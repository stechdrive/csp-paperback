import { describe, expect, it } from 'vitest'
import {
  collectShiftNavigationExpandableFolders,
  collectShiftNavigationExpandedPath,
  flattenVisible,
  mergeExpandedFolders,
} from '../../utils/layerNavigation'
import { buildLayerTree } from '../../engine/tree-builder'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import type { VirtualSet } from '../../types'

function idsByName(layers: ReturnType<typeof buildLayerTree>): Record<string, string> {
  const result: Record<string, string> = {}
  function walk(nodes: typeof layers): void {
    for (const layer of nodes) {
      result[layer.originalName] = layer.id
      walk(layer.children)
    }
  }
  walk(layers)
  return result
}

function makeVirtualSet(id: string, insertionLayerId: string, insertionPosition: 'above' | 'below'): VirtualSet {
  return {
    id,
    name: `vs-${id}`,
    insertionLayerId,
    insertionPosition,
    members: [],
    expandToAnimationCells: false,
    visibilityOverrides: {},
  }
}

describe('Shift navigation expansion helpers', () => {
  it('アニメフォルダとその祖先をShiftナビ用に展開対象にする', () => {
    const psd = makePsd({
      children: [
        makeFolder('root', [
          makeAnimationFolder('A', [
            makeLayer({ name: '1' }),
          ]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd)
    const root = tree[0]
    const anim = root.children[0]
    anim.isAnimationFolder = true
    anim.animationFolder = { detectedBy: 'xdts', trackName: 'A' }

    const expandable = collectShiftNavigationExpandableFolders(tree, new Set())

    expect(expandable.has(root.id)).toBe(true)
    expect(expandable.has(anim.id)).toBe(true)
  })

  it('自動マークフォルダとその祖先をShiftナビ用に展開対象にする', () => {
    const psd = makePsd({
      children: [
        makeFolder('root', [
          makeFolder('_BOOK', [
            makeLayer({ name: 'note' }),
          ]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd)
    const root = tree[0]
    const autoMarked = root.children[0]

    const expandable = collectShiftNavigationExpandableFolders(tree, new Set())

    expect(autoMarked.autoMarked).toBe(true)
    expect(expandable.has(root.id)).toBe(true)
    expect(expandable.has(autoMarked.id)).toBe(true)
  })

  it('手動単体マークの祖先をShiftナビ用に展開対象にする', () => {
    const psd = makePsd({
      children: [
        makeFolder('root', [
          makeLayer({ name: 'marked' }),
        ]),
      ],
    })
    const tree = buildLayerTree(psd)
    const root = tree[0]
    const marked = root.children[0]
    marked.singleMark = true

    const expandable = collectShiftNavigationExpandableFolders(tree, new Set())

    expect(expandable.has(root.id)).toBe(true)
    expect(expandable.has(marked.id)).toBe(false)
  })

  it('もともと開いていたフォルダは一時展開パスに含めない', () => {
    const psd = makePsd({
      children: [
        makeFolder('root', [
          makeAnimationFolder('A', [
            makeLayer({ name: '1' }),
          ]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd)
    const ids = idsByName(tree)
    const root = tree[0]
    const anim = root.children[0]
    anim.isAnimationFolder = true
    anim.animationFolder = { detectedBy: 'manual', trackName: 'A' }
    const expandable = collectShiftNavigationExpandableFolders(tree, new Set())

    const path = collectShiftNavigationExpandedPath(
      tree,
      ids['1'],
      new Set([root.id]),
      expandable,
    )

    expect(path.has(root.id)).toBe(false)
    expect(path.has(anim.id)).toBe(true)
  })

  it('Shiftナビ用の展開状態では閉じたアニメフォルダ配下のセルも候補に入る', () => {
    const psd = makePsd({
      children: [
        makeFolder('root', [
          makeAnimationFolder('A', [
            makeLayer({ name: '1' }),
          ]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd)
    const anim = tree[0].children[0]
    anim.isAnimationFolder = true
    anim.animationFolder = { detectedBy: 'xdts', trackName: 'A' }

    const userExpanded = new Set<string>()
    const shiftExpanded = collectShiftNavigationExpandableFolders(tree, new Set())
    const entries = flattenVisible(
      tree,
      mergeExpandedFolders(userExpanded, shiftExpanded),
      new Set(),
    )

    expect(entries.map(entry => entry.layer.originalName)).toEqual(['root', 'A', '1'])
  })

  it('仮想セットの差し込み位置と祖先をShiftナビ用に展開対象にする', () => {
    const psd = makePsd({
      children: [
        makeFolder('root', [
          makeFolder('notes', [
            makeLayer({ name: 'target' }),
          ]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd)
    const root = tree[0]
    const notes = root.children[0]
    const target = notes.children[0]
    const virtualSets = [makeVirtualSet('vs-1', target.id, 'above')]

    const expandable = collectShiftNavigationExpandableFolders(tree, new Set(), virtualSets)

    expect(expandable.has(root.id)).toBe(true)
    expect(expandable.has(notes.id)).toBe(true)
  })

  it('Shiftナビ候補に仮想セットをレイヤーの上下一致で含める', () => {
    const psd = makePsd({
      children: [
        makeFolder('root', [
          makeLayer({ name: 'target' }),
        ]),
      ],
    })
    const tree = buildLayerTree(psd)
    const root = tree[0]
    const target = root.children[0]
    const virtualSets = [
      makeVirtualSet('vs-above', target.id, 'above'),
      makeVirtualSet('vs-below', target.id, 'below'),
    ]
    const entries = flattenVisible(
      tree,
      new Set([root.id]),
      new Set(),
      virtualSets,
    )

    expect(entries.map(entry =>
      entry.kind === 'virtualSet' ? entry.virtualSet?.name : entry.layer.originalName,
    )).toEqual(['root', 'vs-vs-above', 'target', 'vs-vs-below'])
  })
})
