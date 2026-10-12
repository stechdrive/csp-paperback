import { describe, expect, it, vi } from 'vitest'
import { extractVirtualSetEntries, hasVirtualSetOutput } from '../../engine/cell-extractor'
import { buildLayerTree } from '../../engine/tree-builder'
import type { CspLayer, VirtualSet } from '../../types'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'

function virtualSet(layerId: string, overrides: Partial<VirtualSet> = {}): VirtualSet {
  return {
    id: 'vs', name: 'layout', insertionLayerId: 'missing-anchor', insertionPosition: 'above',
    members: [{ layerId, opacity: null, blendMode: null }],
    expandToAnimationCells: false, visibilityOverrides: {}, ...overrides,
  }
}

function expectOutput(tree: CspLayer[], vs: VirtualSet, expected: boolean) {
  const createElement = vi.spyOn(document, 'createElement')
  expect(hasVirtualSetOutput(tree, vs)).toBe(expected)
  expect(createElement).not.toHaveBeenCalled()
  createElement.mockRestore()
  expect(extractVirtualSetEntries(tree, [vs], 100, 100).length > 0).toBe(expected)
}

describe('hasVirtualSetOutput', () => {
  it('メンバーまたは差し込み先の指定が無ければコンテキストがあっても出力しない', () => {
    const tree = buildLayerTree(makePsd({ children: [makeLayer()] }))
    expectOutput(tree, virtualSet(tree[0].id, { insertionLayerId: null }), false)
    expectOutput(tree, virtualSet(tree[0].id, { insertionLayerId: tree[0].id, members: [] }), false)
  })

  it('メンバーもコンテキストも空のときだけ有効な指定を除外する', () => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('empty', [])] }))
    expectOutput(tree, virtualSet(tree[0].id, { insertionLayerId: tree[0].id }), false)
    expectOutput(tree, virtualSet('missing-member'), false)
    const content = buildLayerTree(makePsd({ children: [makeLayer()] }))
    expectOutput(content, virtualSet(content[0].id), true)
    expectOutput(content, virtualSet('missing-member', { insertionLayerId: content[0].id }), true)
  })

  it('仮想セルの表示指定はuiHiddenを上書きし、PSD hiddenは解除しない', () => {
    const tree = buildLayerTree(makePsd({ children: [makeLayer()] }))
    const layer = tree[0]
    layer.uiHidden = true
    expectOutput(tree, virtualSet(layer.id), false)
    expectOutput(tree, virtualSet(layer.id, { visibilityOverrides: { [layer.id]: true } }), true)
    layer.hidden = true
    expectOutput(tree, virtualSet(layer.id, { visibilityOverrides: { [layer.id]: true } }), false)
    layer.hidden = false
    layer.uiHidden = false
    expectOutput(tree, virtualSet(layer.id, { visibilityOverrides: { [layer.id]: false } }), false)
  })

  it('メンバーを直接参照し、ツリー上の非表示祖先によって除外しない', () => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('parent', [makeLayer()])] }))
    tree[0].hidden = true
    expectOutput(tree, virtualSet(tree[0].children[0].id), true)
    expectOutput(tree, virtualSet(tree[0].id), false)
  })

  it('アニメフォルダでは先頭の可視セルだけを使い、空セルから次を探さない', () => {
    const tree = buildLayerTree(makePsd({ children: [makeAnimationFolder('A', [makeLayer({ name: '2' }), makeFolder('1', [])])] }))
    const anim = tree[0]
    anim.isAnimationFolder = true
    anim.animationFolder = { detectedBy: 'manual', trackName: 'A' }
    expectOutput(tree, virtualSet(anim.id), false)
    expectOutput(tree, virtualSet(anim.id, { visibilityOverrides: { [anim.children[0].id]: false } }), true)
    expectOutput(tree, virtualSet(anim.id, { visibilityOverrides: { [anim.children[1].id]: true } }), false)
  })

  it('通常フォルダ内の表示指定と透明なメンバーも実出力と一致する', () => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('group', [makeLayer()])] }))
    const child = tree[0].children[0]
    expectOutput(tree, virtualSet(tree[0].id, { visibilityOverrides: { [child.id]: false } }), false)
    expectOutput(tree, virtualSet(tree[0].id, {
      members: [{ layerId: tree[0].id, opacity: 0, blendMode: 'pass through' }],
      layerOverrides: { [child.id]: { opacity: 0 } },
    }), true)
  })

  it.each(['vector', '3d'] as const)('canvasがなくても%sの警告プレースホルダーを出力する', kind => {
    const tree = buildLayerTree(makePsd({ children: [makeLayer()] }))
    delete tree[0].agPsdRef.canvas
    expectOutput(tree, virtualSet(tree[0].id), false)
    if (kind === 'vector') tree[0].vectorRendering = 'unavailable'
    else tree[0].unsupported3D = true
    expectOutput(tree, virtualSet(tree[0].id), true)
  })

  it('非表示の差し込み祖先内でも外側コンテキストを実出力と同様に収集する', () => {
    const tree = buildLayerTree(makePsd({ children: [makeLayer({ name: 'paper' }), makeFolder('hidden', [makeLayer({ name: 'anchor' })])] }))
    tree[0].hidden = true
    expectOutput(tree, virtualSet('missing-member', { insertionLayerId: tree[0].children[0].id }), true)
    tree[1].singleMark = true
    tree[0].children[0].singleMark = true
    expectOutput(tree, virtualSet('missing-member', { insertionLayerId: tree[0].children[0].id }), false)
  })
})
