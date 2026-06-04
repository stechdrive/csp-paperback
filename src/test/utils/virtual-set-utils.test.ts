import { describe, expect, it } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { buildMemberFlatsWithOverride, collectMembersInTreeOrder } from '../../utils/virtual-set-utils'
import type { CspLayer, VirtualSetMember } from '../../types'
import { makeLayer, makePassThroughFolder, makePsd } from '../helpers/psd-factory'

function findLayerByName(layers: CspLayer[], name: string): CspLayer {
  for (const layer of layers) {
    if (layer.originalName === name) return layer
    const found = findLayerByNameOrNull(layer.children, name)
    if (found) return found
  }
  throw new Error(`Layer not found: ${name}`)
}

function findLayerByNameOrNull(layers: CspLayer[], name: string): CspLayer | null {
  for (const layer of layers) {
    if (layer.originalName === name) return layer
    const found = findLayerByNameOrNull(layer.children, name)
    if (found) return found
  }
  return null
}

describe('virtual-set-utils', () => {
  it('フォルダ配下レイヤーの仮想セル内overrideをFlatLayerに反映し、元レイヤーは変更しない', () => {
    const psd = makePsd({
      children: [
        makePassThroughFolder('group', [
          makeLayer({ name: 'bottom', opacity: 1, blendMode: 'normal' }),
          makeLayer({ name: 'target', opacity: 0.25, blendMode: 'normal' }),
        ]),
      ],
    })
    const tree = buildLayerTree(psd)
    const group = findLayerByName(tree, 'group')
    const target = findLayerByName(tree, 'target')
    const members: VirtualSetMember[] = [{ layerId: group.id, blendMode: null, opacity: null }]
    const memberLayers = collectMembersInTreeOrder(tree, new Set([group.id]))

    const flats = buildMemberFlatsWithOverride(
      members,
      memberLayers,
      100,
      100,
      {},
      { [target.id]: { blendMode: 'multiply', opacity: 40 } },
    )
    const targetFlat = flats.find(flat => flat.sourceId === target.id)

    expect(targetFlat?.blendMode).toBe('multiply')
    expect(targetFlat?.opacity).toBe(40)
    expect(target.blendMode).toBe('normal')
    expect(target.opacity).toBe(25)
  })

  it('overrideしたpass throughフォルダは仮想セル内でグループ化して不透明度を適用する', () => {
    const psd = makePsd({
      children: [
        makePassThroughFolder('group', [
          makeLayer({ name: 'bottom', opacity: 1 }),
          makeLayer({ name: 'top', opacity: 1 }),
        ]),
      ],
    })
    const tree = buildLayerTree(psd)
    const group = findLayerByName(tree, 'group')
    const members: VirtualSetMember[] = [{ layerId: group.id, blendMode: null, opacity: null }]
    const memberLayers = collectMembersInTreeOrder(tree, new Set([group.id]))

    const flats = buildMemberFlatsWithOverride(
      members,
      memberLayers,
      100,
      100,
      {},
      { [group.id]: { opacity: 50 } },
    )

    expect(flats).toHaveLength(1)
    expect(flats[0].sourceId).toBe(group.id)
    expect(flats[0].opacity).toBe(50)
  })
})
