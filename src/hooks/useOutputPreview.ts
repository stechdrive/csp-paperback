import { useMemo } from 'react'
import { useAppStore } from '../store'
import { selectLayerTreeWithVisibility, selectOutputFiles } from '../store/selectors'
import { collectContextSourceLayers, renderOutputPlans } from '../engine/cell-extractor'
import { collectCellOutputUnits } from '../engine/cell-output-units'
import { flattenTree, compositeRoot } from '../engine/flatten'
import { collectMembersInTreeOrder, buildMemberFlatsWithOverride } from '../utils/virtual-set-utils'
import { resolveSelectedAnimCell } from '../utils/anim-cell-selection'
import type { CspLayer } from '../types'
import type { OutputFile } from '../utils/output-plan'
import { applyRevisionBorders } from '../utils/revision-border'
import { hasVectorWarning, hasUnsupported3D } from '../engine/render-warning'

export interface OutputPreviewEntry {
  vectorWarning?: boolean
  unsupported3D?: boolean
  canvas: HTMLCanvasElement
  flatName: string
  path: string
}

/** Names and rendering share the export plan; only selected files are composited. */
export function useOutputPreview(enabled = true): OutputPreviewEntry[] {
  const layerTree = useAppStore(selectLayerTreeWithVisibility)
  const files = useAppStore(selectOutputFiles)
  const focusedAnimFolderId = useAppStore(s => s.focusedAnimFolderId)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const selectedOutputSourceId = useAppStore(s => s.selectedOutputSourceId)
  const virtualSets = useAppStore(s => s.virtualSets)
  const selectedCellIndex = useAppStore(s => s.focusedAnimFolderId ? s.selectedCells.get(s.focusedAnimFolderId) : undefined)
  const projectSettings = useAppStore(s => s.projectSettings)
  const outputConfig = useAppStore(s => s.outputConfig)
  const docWidth = useAppStore(s => s.docWidth)
  const docHeight = useAppStore(s => s.docHeight)

  return useMemo(() => {
    if (!enabled || docWidth === 0 || docHeight === 0) return []
    const render = (selected: OutputFile[]): OutputPreviewEntry[] => {
      if (!selected.length) return []
      return applyRevisionBorders(renderOutputPlans(selected), projectSettings.processTable,
        outputConfig.revisionBorderEnabled).map((entry, index) => ({
        canvas: entry.canvas,
        vectorWarning: hasVectorWarning(entry.canvas),
        unsupported3D: hasUnsupported3D(entry.canvas),
        flatName: selected[index].names.flatName,
        path: selected[index].names.path,
      }))
    }

    if (selectedVirtualSetId) {
      const vs = virtualSets.find(v => v.id === selectedVirtualSetId)
      if (!vs || vs.members.length === 0) return []
      if (vs.insertionLayerId) return render(files.filter(file => file.sourceLayerId === vs.id))

      // 未配置: グローバルコンテキストで仮プレビュー（ZIP出力対象外）
      const memberIdSet = new Set(vs.members.map(m => m.layerId))
      const memberLayers = collectMembersInTreeOrder(layerTree, memberIdSet)
      if (memberLayers.length === 0) return []
      const contextFlats = flattenTree(collectContextSourceLayers(layerTree), docWidth, docHeight)
      const memberFlats = buildMemberFlatsWithOverride(
        vs.members, memberLayers, docWidth, docHeight, vs.visibilityOverrides, vs.layerOverrides ?? {},
      )
      const canvas = compositeRoot(
        [...contextFlats, ...memberFlats], docWidth, docHeight, outputConfig.background,
      )
      return [{ canvas, flatName: vs.name, path: '', vectorWarning: hasVectorWarning(canvas), unsupported3D: hasUnsupported3D(canvas) }]
    }

    const animCell = !focusedAnimFolderId && selectedLayerId
      ? findAnimCellAncestor(selectedLayerId, layerTree) : null
    const animFolderId = focusedAnimFolderId ?? animCell?.animFolderId
    if (animFolderId) {
      const anim = findLayerById(layerTree, animFolderId)
      if (!anim?.isAnimationFolder) return []
      const selection = resolveSelectedAnimCell(anim, focusedAnimFolderId ? selectedCellIndex : animCell?.cellChildIndex)
      if (!selection) return []
      let source = focusedAnimFolderId ? selectedOutputSourceId : selectedLayerId
      if (!focusedAnimFolderId && source) {
        // Direct artwork clicks resolve to their containing body or merged process.
        const units = collectCellOutputUnits(anim, projectSettings.processTable)
          .filter(unit => unit.cell.id === selection.cell.id)
        const unit = units.find(unit => unit.sourceLayerId === source)
          ?? units.find(unit => !!findLayerById(unit.layers, source!))
        if (!unit) return []
        source = unit.sourceLayerId
      }
      return render(files.filter(file => file.animFolderId === anim.id &&
        file.sourceCellId === selection.cell.id && (!source || file.sourceLayerId === source)))
    }

    return render(files.filter(file => file.sourceLayerId === selectedLayerId))
  }, [files, focusedAnimFolderId, selectedVirtualSetId, selectedLayerId, selectedOutputSourceId,
    virtualSets, selectedCellIndex, layerTree, projectSettings, outputConfig, docWidth, docHeight, enabled])
}

/**
 * レイヤーがアニメーションフォルダのセル内部にある場合、
 * そのアニメフォルダ ID とセルの children インデックスを返す。
 *
 * 直接の子であるセルと、セル内部の工程・内容レイヤーを対象とする。
 */
function findAnimCellAncestor(
  layerId: string,
  tree: CspLayer[],
): { animFolderId: string; cellChildIndex: number } | null {
  function walk(
    layers: CspLayer[],
    ctx: { animFolderId: string; cellChildIndex: number } | null,
  ): { animFolderId: string; cellChildIndex: number } | null {
    for (const layer of layers) {
      if (layer.hidden || layer.uiHidden) continue
      if (layer.id === layerId) return ctx
      if (!layer.isFolder) continue

      if (layer.isAnimationFolder) {
        // 直接のセルも含めて調べ、出力単位巡回では本体だけを表示できるようにする。
        for (let i = 0; i < layer.children.length; i++) {
          const cell = layer.children[i]
          const result = walk([cell], { animFolderId: layer.id, cellChildIndex: i })
          if (result) return result
        }
      } else {
        const result = walk(layer.children, ctx)
        if (result) return result
      }
    }
    return null
  }
  return walk(tree, null)
}

function findLayerById(layers: CspLayer[], id: string): CspLayer | null {
  for (const l of layers) {
    if (l.hidden || l.uiHidden) continue
    if (l.id === id) return l
    const found = findLayerById(l.children, id)
    if (found) return found
  }
  return null
}
