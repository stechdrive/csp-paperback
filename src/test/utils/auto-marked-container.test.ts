import { describe, expect, it } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import type { CspLayer } from '../../types'
import {
  isAutoMarkedContainerOutputSuppressed,
  isAutoMarkedOutputTarget,
} from '../../utils/auto-marked-container'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'

function findByName(layers: CspLayer[], name: string): CspLayer | null {
  for (const layer of layers) {
    if (layer.originalName === name) return layer
    const found = findByName(layer.children, name)
    if (found) return found
  }
  return null
}

describe('auto-marked container suppression', () => {
  it('直下が_フォルダだけなら親_フォルダを整理用コンテナとして抑制する', () => {
    const tree = buildLayerTree(makePsd({
      children: [
        makeFolder('_TEST', [
          makeFolder('_IMG', [makeLayer({ name: 'image' })]),
          makeFolder('_BOOK', [makeLayer({ name: 'book' })]),
        ]),
      ],
    }))

    const parent = tree[0]
    const child = findByName(parent.children, '_IMG')!

    expect(isAutoMarkedContainerOutputSuppressed(parent)).toBe(true)
    expect(isAutoMarkedOutputTarget(parent)).toBe(false)
    expect(isAutoMarkedContainerOutputSuppressed(child)).toBe(false)
    expect(isAutoMarkedOutputTarget(child)).toBe(true)
  })

  it('直下に通常フォルダが混じる場合は親_フォルダを抑制しない', () => {
    const tree = buildLayerTree(makePsd({
      children: [
        makeFolder('_TEST', [
          makeFolder('通常フォルダ', [makeLayer({ name: 'body' })]),
          makeFolder('_IMG', [makeLayer({ name: 'image' })]),
        ]),
      ],
    }))

    expect(isAutoMarkedContainerOutputSuppressed(tree[0])).toBe(false)
    expect(isAutoMarkedOutputTarget(tree[0])).toBe(true)
  })

  it('非表示の通常フォルダは判定から除外する', () => {
    const tree = buildLayerTree(makePsd({
      children: [
        makeFolder('_TEST', [
          makeFolder('通常フォルダ', [makeLayer({ name: 'body' })]),
          makeFolder('_IMG', [makeLayer({ name: 'image' })]),
        ]),
      ],
    }))
    findByName(tree, '通常フォルダ')!.uiHidden = true

    expect(isAutoMarkedContainerOutputSuppressed(tree[0])).toBe(true)
  })

  it.each(['hidden', 'uiHidden'] as const)('独立出力の子をすべて%sにしても親画像を追加しない', visibility => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('_TEST', [
      makeFolder('_IMG', [makeLayer()]),
      makeFolder('ANIME', [makeLayer({ name: '1' })]),
      makeFolder('手動素材', [makeLayer()]),
    ])] }))
    const parent = tree[0]
    const anime = findByName(tree, 'ANIME')!
    anime.isAnimationFolder = true
    anime.animationFolder = { detectedBy: 'clip', trackName: 'ANIME' }
    findByName(tree, '手動素材')!.singleMark = true
    for (const child of parent.children) child[visibility] = true

    expect(isAutoMarkedContainerOutputSuppressed(parent)).toBe(true)
    expect(isAutoMarkedContainerOutputSuppressed(parent, true)).toBe(true)
    expect(isAutoMarkedOutputTarget(parent)).toBe(false)

    // Explicitly requesting the parent still permits its context-only image.
    parent.singleMark = true
    expect(isAutoMarkedContainerOutputSuppressed(parent)).toBe(false)
  })

  it.each(['layer', 'folder'] as const)('通常の%sを持つ親は全非表示でも従来の単独出力を保つ', kind => {
    const content = kind === 'folder' ? makeFolder('原画', [makeLayer()]) : makeLayer({ name: '原画' })
    const tree = buildLayerTree(makePsd({ children: [makeFolder('_TEST', [
      content, makeFolder('_IMG', [makeLayer()]),
    ])] }))
    for (const child of tree[0].children) child.uiHidden = true

    expect(isAutoMarkedContainerOutputSuppressed(tree[0])).toBe(false)
    expect(isAutoMarkedContainerOutputSuppressed(tree[0], true)).toBe(false)
    expect(isAutoMarkedOutputTarget(tree[0])).toBe(true)
  })

  it('XDTS/手動由来のアニメーションフォルダも直下の出力単位として扱う', () => {
    const tree = buildLayerTree(makePsd({
      children: [
        makeFolder('_TEST', [
          makeFolder('ANIME', [makeLayer({ name: '1' })]),
        ]),
      ],
    }))
    const anime = findByName(tree, 'ANIME')!
    anime.isAnimationFolder = true
    anime.animationFolder = { detectedBy: 'xdts', trackName: 'ANIME' }

    expect(isAutoMarkedContainerOutputSuppressed(tree[0])).toBe(true)
  })

  it('親を手動マークした場合は抑制しない', () => {
    const tree = buildLayerTree(makePsd({
      children: [
        makeFolder('_TEST', [
          makeFolder('_IMG', [makeLayer({ name: 'image' })]),
        ]),
      ],
    }))
    tree[0].singleMark = true

    expect(isAutoMarkedContainerOutputSuppressed(tree[0])).toBe(false)
    expect(isAutoMarkedOutputTarget(tree[0])).toBe(false)
  })

  it('archivePatternsで除外された_フォルダは出力単位として扱わない', () => {
    const tree = buildLayerTree(makePsd({
      children: [
        makeFolder('_TEST', [
          makeFolder('_old_IMG', [makeLayer({ name: 'image' })]),
          makeFolder('_BOOK', [makeLayer({ name: 'book' })]),
        ]),
      ],
    }), undefined, ['_old'])

    expect(isAutoMarkedContainerOutputSuppressed(tree[0])).toBe(false)
    expect(isAutoMarkedOutputTarget(tree[0])).toBe(true)
  })
})
