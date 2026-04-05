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
 * 仮想セル固有の表示非表示オーバーライドをレイヤーサブツリーに再帰適用する。
 * 変更がない場合は元の参照をそのまま返す（不要な再レンダリング防止）。
 */
function applyVsVisibilityOverrides(
  layer: CspLayer,
  overrides: Record<string, boolean>,
): CspLayer {
  const overrideVal = overrides[layer.id]
  const uiHidden = overrideVal !== undefined ? !overrideVal : layer.uiHidden

  if (layer.children.length === 0) {
    if (uiHidden === layer.uiHidden) return layer
    return { ...layer, uiHidden }
  }

  const children = layer.children.map(c => applyVsVisibilityOverrides(c, overrides))
  const childrenChanged = children.some((c, i) => c !== layer.children[i])

  if (uiHidden === layer.uiHidden && !childrenChanged) return layer
  return { ...layer, uiHidden, children }
}

/**
 * VirtualSetMember の blendMode override と visibilityOverrides を適用しながら
 * FlatLayer[] を構築する。
 * - blendMode が非 null: そのメンバーレイヤーを compositeGroup で1枚に合成してから blendMode を上書き
 * - blendMode が null: flattenTree の結果をそのまま展開
 * - visibilityOverrides: メンバー内各レイヤーの表示非表示を個別制御（フォルダ対応）
 */
export function buildMemberFlatsWithOverride(
  members: VirtualSetMember[],
  memberLayers: CspLayer[],
  docWidth: number,
  docHeight: number,
  visibilityOverrides: Record<string, boolean> = {},
): FlatLayer[] {
  const layerMap = new Map(memberLayers.map(l => [l.id, l]))
  const hasOverrides = Object.keys(visibilityOverrides).length > 0
  const result: FlatLayer[] = []

  // UI上のリスト順（上が上レイヤー）に合わせ、下のレイヤーから先に合成する
  for (const member of [...members].reverse()) {
    const layer = layerMap.get(member.layerId)
    if (!layer) continue

    // 仮想セル固有の表示状態を適用
    const effectiveLayer = hasOverrides
      ? applyVsVisibilityOverrides(layer, visibilityOverrides)
      : layer

    const flats = flattenTree([effectiveLayer], docWidth, docHeight)
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
