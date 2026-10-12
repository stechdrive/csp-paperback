import { useMemo } from 'react'
import { useAppStore } from '../store'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import {
  extractCells,
  extractVirtualSetEntries,
  resolveParentSuffix,
  collectContextSourceLayers,
  collectLocalSiblingContext,
  collectMarkedLayerContext,
  collectMaterialOutputContext,
  compositeWithContext,
  buildParentSuffixMap,
  buildEffectiveAnimationAssignment,
  buildSequenceNamingPlan,
} from '../engine/cell-extractor'
import { computeDisplayNames } from '../engine/anim-folder-display-name'
import { collectCellOutputUnits } from '../engine/cell-output-units'
import { flattenTree, compositeRoot } from '../engine/flatten'
import { replaceExtension } from '../utils/image-export'
import { collectMembersInTreeOrder, buildMemberFlatsWithOverride } from '../utils/virtual-set-utils'
import { resolveSelectedAnimCell } from '../utils/anim-cell-selection'
import { isAutoMarkedContainerOutputSuppressed } from '../utils/auto-marked-container'
import {
  type CspLayer,
  type OutputEntry,
  type ProjectSettings,
  type OutputConfig,
  type OutputFormat,
  type TimelineData,
} from '../types'
import { applyRevisionBorders } from '../utils/revision-border'
import { hasVectorWarning, hasUnsupported3D } from '../engine/render-warning'

export interface OutputPreviewEntry {
  vectorWarning?: boolean
  unsupported3D?: boolean
  canvas: HTMLCanvasElement
  flatName: string
  path: string
}

function replacePreviewExtension(fileName: string, format: OutputFormat): string {
  return fileName ? replaceExtension(fileName, format) : fileName
}

function mapPreviewEntries(
  entries: OutputEntry[],
  format: OutputFormat,
  projectSettings: ProjectSettings,
  revisionBorderEnabled: boolean,
): OutputPreviewEntry[] {
  return applyRevisionBorders(
    entries,
    projectSettings.processTable,
    revisionBorderEnabled,
  ).map(e => ({
    canvas: e.canvas,
    vectorWarning: hasVectorWarning(e.canvas),
    unsupported3D: hasUnsupported3D(e.canvas),
    flatName: replacePreviewExtension(e.flatName, format),
    path: replacePreviewExtension(e.path, format),
  }))
}

/**
 * 選択状態に応じた出力プレビューエントリを返す。
 *
 * すべてのパスが実出力（extractCells / extractVirtualSetEntries / collectMarkedLayerContext）と
 * 同一の関数を経由するため、プレビューと実出力の一致が構造的に保証される。
 *
 * ルーティング:
 *   1. 仮想セット選択（配置済み）  → extractVirtualSetEntries（ZIP出力と同一）
 *   1. 仮想セット選択（未配置）    → グローバルコンテキストで仮プレビュー（ZIP対象外）
 *   2. アニメセル選択              → extractCells（ZIP出力と同一）
 *   3. autoMarked/singleMark
 *      └ アニメセル内部のレイヤー  → extractCells（セル特定後にフィルタ）
 *      └ アニメセル外のレイヤー    → collectMarkedLayerContext（extractAllEntriesと同一）
 */
export function useOutputPreview(enabled = true): OutputPreviewEntry[] {
  const layerTree = useAppStore(selectLayerTreeWithVisibility)
  const focusedAnimFolderId = useAppStore(s => s.focusedAnimFolderId)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const selectedOutputSourceId = useAppStore(s => s.selectedOutputSourceId)
  const virtualSets = useAppStore(s => s.virtualSets)
  const selectedCellIndex = useAppStore(s => s.focusedAnimFolderId ? s.selectedCells.get(s.focusedAnimFolderId) : undefined)
  const projectSettings = useAppStore(s => s.projectSettings)
  const outputConfig = useAppStore(s => s.outputConfig)
  const timelineData = useAppStore(s => s.timelineData)
  const docWidth = useAppStore(s => s.docWidth)
  const docHeight = useAppStore(s => s.docHeight)

  return useMemo(() => {
    if (!enabled || docWidth === 0 || docHeight === 0) return []

    // ── 1. 仮想セット選択 ──────────────────────────────────────────────────
    if (selectedVirtualSetId) {
      const vs = virtualSets.find(v => v.id === selectedVirtualSetId)
      if (!vs || vs.members.length === 0) return []

      if (vs.insertionLayerId) {
        // 配置済み: ZIP出力と同じ extractVirtualSetEntries を使用
        const entries = extractVirtualSetEntries(
          layerTree, [vs], docWidth, docHeight, outputConfig.background,
        )
        return mapPreviewEntries(
          entries,
          outputConfig.format,
          projectSettings,
          outputConfig.revisionBorderEnabled,
        )
      }

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

    // ── 2. アニメーションフォルダ選択（直接セルクリック） ──────────────────
    if (focusedAnimFolderId) {
      return previewAnimFolder(
        focusedAnimFolderId,
        selectedCellIndex,
        selectedOutputSourceId,
        layerTree, projectSettings, outputConfig, timelineData, docWidth, docHeight,
        true,
      )
    }

    if (!selectedLayerId) return []

    // ── 3a. autoMarked/singleMark がアニメセル内にある場合 ─────────────────
    // （例: アニメセル内の工程フォルダ _k など）
    // extractCells を経由することで実出力と一致を保証する
    const animCellCtx = findAnimCellAncestor(selectedLayerId, layerTree)
    if (animCellCtx) {
      return previewAnimFolder(
        animCellCtx.animFolderId,
        animCellCtx.cellChildIndex,
        selectedLayerId,
        layerTree, projectSettings, outputConfig, timelineData, docWidth, docHeight,
      )
    }

    // ── 3b. autoMarked/singleMark（アニメセル外） ──────────────────────────
    // extractAllEntries と同じ collectMarkedLayerContext を使用
    const markedLayer = findLayerById(layerTree, selectedLayerId)
    if (
      markedLayer &&
      !markedLayer.isAnimationFolder &&
      (markedLayer.autoMarked || markedLayer.singleMark) &&
      (!markedLayer.autoMarked || markedLayer.singleMark || !outputConfig.excludeAutoMarked) &&
      !isAutoMarkedContainerOutputSuppressed(markedLayer)
    ) {
      const { lower, upper } = collectMarkedLayerContext(selectedLayerId, layerTree, docWidth, docHeight)
      const layerFlats = flattenTree([markedLayer], docWidth, docHeight)
      const canvas = compositeWithContext(
        layerFlats, lower, upper, docWidth, docHeight, outputConfig.background,
        collectMaterialOutputContext(selectedLayerId, layerTree, docWidth, docHeight),
      )
      const fileName = replacePreviewExtension(`${markedLayer.originalName}.jpg`, outputConfig.format)
      return [{ canvas, flatName: fileName, path: fileName, vectorWarning: hasVectorWarning(canvas), unsupported3D: hasUnsupported3D(canvas) }]
    }

    return []
  }, [
    focusedAnimFolderId, selectedVirtualSetId, selectedLayerId, selectedOutputSourceId,
    virtualSets, selectedCellIndex, layerTree, projectSettings, outputConfig, timelineData,
    docWidth, docHeight, enabled,
  ])
}

/**
 * 指定アニメーションフォルダの選択セルだけを extractCells で描画する。
 *
 * 巡回時は指定sourceだけを表示し、内部素材クリック時は所有する出力単位へ解決する。
 * 対象が非表示・除外・削除されたときは他の出力へフォールバックしない。
 */
function previewAnimFolder(
  animFolderId: string,
  rawCellIndex: number | undefined,
  filterSourceLayerId: string | null,
  layerTree: CspLayer[],
  projectSettings: ProjectSettings,
  outputConfig: OutputConfig,
  timelineData: TimelineData | null,
  docWidth: number,
  docHeight: number,
  exactOutputSource = false,
): OutputPreviewEntry[] {
  const animFolder = findLayerById(layerTree, animFolderId)
  if (!animFolder || !animFolder.isAnimationFolder) return []

  const selection = resolveSelectedAnimCell(animFolder, rawCellIndex)
  if (!selection) return []
  const selectedCell = selection.cell

  const parentSuffix = resolveParentSuffix(animFolderId, layerTree, projectSettings.processTable)
  const excluded = new Set(outputConfig.excludedProcessSuffixes)
  if (parentSuffix && excluded.has(parentSuffix)) return []

  let targetSourceLayerId: string | undefined
  if (filterSourceLayerId) {
    const units = collectCellOutputUnits(animFolder, projectSettings.processTable)
      .filter(unit => unit.cell.id === selectedCell.id)
    const exact = units.find(unit => unit.sourceLayerId === filterSourceLayerId)
    const target = exact ?? (!exactOutputSource
      ? units.find(unit => !!findLayerById(unit.layers, filterSourceLayerId))
      : undefined)
    if (!target || (target.processSuffix && excluded.has(target.processSuffix))) return []
    targetSourceLayerId = target.sourceLayerId
  }

  const { lower: lowerContextFlats, upper: localUpperFlats } =
    collectLocalSiblingContext(animFolderId, layerTree, docWidth, docHeight)

  // displayName を計算(extractAllEntries と同じロジック)
  // Identity = (name, parentSuffix)。同一 identity に複数候補のあるケースのみ (n) 連番化し、
  // process variants(同名だが parentSuffix 異なる)は両方とも base 名のまま。
  // これによりプレビューと実出力のファイル名が構造的に一致する。
  const parentSuffixMap = buildParentSuffixMap(layerTree, projectSettings.processTable)
  const assignment = buildEffectiveAnimationAssignment(layerTree)
  const displayNames = computeDisplayNames(layerTree, assignment, parentSuffixMap)
  const displayName = displayNames.get(animFolderId) ?? animFolder.originalName.trim()
  const sequenceNamingPlan = buildSequenceNamingPlan(
    layerTree,
    projectSettings,
    timelineData,
    displayNames,
  )

  let entries: OutputEntry[] = extractCells(
    animFolder, projectSettings, docWidth, docHeight, lowerContextFlats,
    parentSuffix, displayName, outputConfig.background, localUpperFlats,
    outputConfig.processSuffixPosition,
    sequenceNamingPlan.digits,
    sequenceNamingPlan.sheetSequenceNumbers,
    collectMaterialOutputContext(animFolderId, layerTree, docWidth, docHeight),
    selectedCell.id,
  )

  entries = entries.filter(entry =>
    (targetSourceLayerId === undefined || entry.sourceLayerId === targetSourceLayerId) &&
    !entry.processSuffixes?.some(suffix => excluded.has(suffix)),
  )

  return mapPreviewEntries(
    entries,
    outputConfig.format,
    projectSettings,
    outputConfig.revisionBorderEnabled,
  )
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
