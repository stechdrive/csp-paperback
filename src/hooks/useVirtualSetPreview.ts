import { useMemo } from 'react'
import { useAppStore } from '../store'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import { collectContextSourceLayers } from '../engine/cell-extractor'
import { flattenTree, compositeRoot } from '../engine/flatten'
import { collectMembersInTreeOrder, buildMemberFlatsWithOverride } from '../utils/virtual-set-utils'

/**
 * 指定した仮想セルIDの合成プレビューcanvasを返す。
 * メンバーが空またはPSD未読み込みの場合はnullを返す。
 */
export function useVirtualSetPreview(vsId: string | null): HTMLCanvasElement | null {
  const layerTree = useAppStore(selectLayerTreeWithVisibility)
  const virtualSets = useAppStore(s => s.virtualSets)
  const outputConfig = useAppStore(s => s.outputConfig)
  const docWidth = useAppStore(s => s.docWidth)
  const docHeight = useAppStore(s => s.docHeight)

  return useMemo(() => {
    if (!vsId || docWidth === 0 || docHeight === 0) return null
    const vs = virtualSets.find(v => v.id === vsId)
    if (!vs || vs.members.length === 0) return null

    const memberIdSet = new Set(vs.members.map(m => m.layerId))
    const memberLayers = collectMembersInTreeOrder(layerTree, memberIdSet)
    if (memberLayers.length === 0) return null

    const contextFlats = flattenTree(collectContextSourceLayers(layerTree), docWidth, docHeight)
    const memberFlats = buildMemberFlatsWithOverride(vs.members, memberLayers, docWidth, docHeight, vs.visibilityOverrides)
    return compositeRoot([...contextFlats, ...memberFlats], docWidth, docHeight, outputConfig.background)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vsId, virtualSets, layerTree, outputConfig, docWidth, docHeight])
}
