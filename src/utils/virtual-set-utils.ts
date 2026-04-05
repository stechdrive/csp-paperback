import { flattenTree } from '../engine/flatten'
import { compositeGroup } from '../engine/compositor'
import type { CspLayer, FlatLayer } from '../types'
import type { VirtualSetMember } from '../types/marks'

/** ツリー順を維持しながら memberIds に含まれるレイヤーを収集する */
export function collectMembersInTreeOrder(layers: CspLayer[], memberIds: Set<string>): CspLayer[] {
  const result: CspLayer[] = []
  for (const layer of layers) {
    if (memberIds.has(layer.id)) {
      result.push(layer)
    } else if (layer.children.length > 0) {
      result.push(...collectMembersInTreeOrder(layer.children, memberIds))
    }
  }
  return result
}

/**
 * VirtualSetMember の blendMode override を適用しながら FlatLayer[] を構築する。
 * - blendMode が非 null: そのメンバーレイヤーを compositeGroup で1枚に合成してから blendMode を上書き
 * - blendMode が null: flattenTree の結果をそのまま展開
 */
export function buildMemberFlatsWithOverride(
  members: VirtualSetMember[],
  memberLayers: CspLayer[],
  docWidth: number,
  docHeight: number,
): FlatLayer[] {
  const layerMap = new Map(memberLayers.map(l => [l.id, l]))
  const result: FlatLayer[] = []

  for (const member of members) {
    const layer = layerMap.get(member.layerId)
    if (!layer) continue

    const flats = flattenTree([layer], docWidth, docHeight)
    if (flats.length === 0) continue

    if (member.blendMode !== null) {
      const composited = compositeGroup(flats, docWidth, docHeight)
      result.push({
        canvas: composited,
        blendMode: member.blendMode as FlatLayer['blendMode'],
        top: 0,
        left: 0,
        sourceId: member.layerId,
        clipping: false,
      })
    } else {
      result.push(...flats)
    }
  }

  return result
}
