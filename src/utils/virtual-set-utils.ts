import { compositeGroup, applyLayerMask } from '../engine/compositor'
import { collectAnimFolderAncestorIds } from '../engine/tree-builder'
import { resolveSelectedAnimCell } from './anim-cell-selection'
import type { BlendMode, CspLayer, FlatLayer } from '../types'
import type { VirtualSetLayerOverride, VirtualSetMember } from '../types/marks'

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

function buildCompositeOverrideMap(
  members: VirtualSetMember[],
  layerOverrides: Record<string, VirtualSetLayerOverride>,
): Record<string, VirtualSetLayerOverride> {
  const result: Record<string, VirtualSetLayerOverride> = { ...layerOverrides }
  for (const member of members) {
    if (member.blendMode === null && member.opacity === null) continue
    result[member.layerId] = {
      ...(member.blendMode !== null ? { blendMode: member.blendMode } : {}),
      ...(member.opacity !== null ? { opacity: member.opacity } : {}),
      ...(result[member.layerId] ?? {}),
    }
  }
  return result
}

function hasCompositeOverride(override: VirtualSetLayerOverride | undefined): boolean {
  return override?.blendMode !== undefined || override?.opacity !== undefined
}

/**
 * 仮想セル専用の合成設定を使ってフラット化する。
 * 通常の flattenTree と違い、override 済みフォルダは pass through でも一度グループ化し、
 * フォルダ自体の opacity/blendMode を仮想セル内だけに適用する。
 */
function flattenTreeWithCompositeOverrides(
  rootChildren: CspLayer[],
  docWidth: number,
  docHeight: number,
  layerOverrides: Record<string, VirtualSetLayerOverride>,
): FlatLayer[] {
  const animAncestorIds = collectAnimFolderAncestorIds(rootChildren)

  function flattenLayer(layer: CspLayer): FlatLayer[] {
    if (layer.hidden || layer.uiHidden) return []

    const override = layerOverrides[layer.id]
    const hasOverride = hasCompositeOverride(override)
    const effectiveBlendMode = (override?.blendMode ?? layer.blendMode) as BlendMode
    const effectiveOpacity = override?.opacity ?? layer.opacity

    if (layer.isAnimationFolder) {
      const selection = resolveSelectedAnimCell(layer, undefined)
      if (!selection) return []
      const cellFlats = flattenLayer(selection.cell)
      if (cellFlats.length === 0) return []
      const rawCanvas = compositeGroup(cellFlats, docWidth, docHeight)
      const maskData = layer.agPsdRef.mask
      const finalCanvas = (maskData?.canvas && !maskData.disabled)
        ? applyLayerMask(rawCanvas, 0, 0, maskData, docWidth, docHeight)
        : rawCanvas
      return [{
        canvas: finalCanvas,
        blendMode: effectiveBlendMode,
        opacity: effectiveOpacity,
        top: 0,
        left: 0,
        sourceId: layer.id,
        clipping: layer.clipping,
      }]
    }

    if (layer.isFolder && animAncestorIds.has(layer.id) && !hasOverride) {
      const childFlats: FlatLayer[] = []
      for (const child of [...layer.children].reverse()) {
        childFlats.push(...flattenLayer(child))
      }
      return childFlats
    }

    if (layer.isFolder) {
      const childFlats: FlatLayer[] = []
      for (const child of [...layer.children].reverse()) {
        childFlats.push(...flattenLayer(child))
      }
      if (childFlats.length === 0) return []

      if (effectiveBlendMode === 'pass through' && !hasOverride) {
        return childFlats
      }

      const rawCanvas = compositeGroup(childFlats, docWidth, docHeight)
      const maskData = layer.agPsdRef.mask
      const finalCanvas = (maskData?.canvas && !maskData.disabled)
        ? applyLayerMask(rawCanvas, 0, 0, maskData, docWidth, docHeight)
        : rawCanvas
      return [{
        canvas: finalCanvas,
        blendMode: effectiveBlendMode,
        opacity: effectiveOpacity,
        top: 0,
        left: 0,
        sourceId: layer.id,
        clipping: layer.clipping,
      }]
    }

    const canvas = layer.agPsdRef.canvas
    if (!canvas) return []

    const maskData = layer.agPsdRef.mask
    const hasMask = !!(maskData?.canvas && !maskData.disabled)
    const finalCanvas = hasMask
      ? applyLayerMask(canvas, layer.top, layer.left, maskData!, docWidth, docHeight)
      : canvas

    return [{
      canvas: finalCanvas,
      blendMode: effectiveBlendMode,
      opacity: effectiveOpacity,
      top: hasMask ? 0 : layer.top,
      left: hasMask ? 0 : layer.left,
      sourceId: layer.id,
      clipping: layer.clipping,
    }]
  }

  const result: FlatLayer[] = []
  for (const layer of [...rootChildren].reverse()) {
    result.push(...flattenLayer(layer))
  }
  return result
}

/**
 * VirtualSetMember の blendMode override と visibilityOverrides を適用しながら
 * FlatLayer[] を構築する。
 * - visibilityOverrides: メンバー内各レイヤーの表示非表示を個別制御（フォルダ対応）
 * - layerOverrides: 仮想セル内だけの合成モード/不透明度を個別制御（フォルダ配下対応）
 */
export function buildMemberFlatsWithOverride(
  members: VirtualSetMember[],
  memberLayers: CspLayer[],
  docWidth: number,
  docHeight: number,
  visibilityOverrides: Record<string, boolean> = {},
  layerOverrides: Record<string, VirtualSetLayerOverride> = {},
): FlatLayer[] {
  const layerMap = new Map(memberLayers.map(l => [l.id, l]))
  const hasOverrides = Object.keys(visibilityOverrides).length > 0
  const compositeOverrides = buildCompositeOverrideMap(members, layerOverrides)
  const result: FlatLayer[] = []

  // UI上のリスト順（上が上レイヤー）に合わせ、下のレイヤーから先に合成する
  for (const member of [...members].reverse()) {
    const layer = layerMap.get(member.layerId)
    if (!layer) continue

    // 仮想セル固有の表示状態を適用
    const effectiveLayer = hasOverrides
      ? applyVsVisibilityOverrides(layer, visibilityOverrides)
      : layer

    result.push(...flattenTreeWithCompositeOverrides(
      [effectiveLayer], docWidth, docHeight, compositeOverrides,
    ))
  }

  return result
}
