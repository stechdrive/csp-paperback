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
