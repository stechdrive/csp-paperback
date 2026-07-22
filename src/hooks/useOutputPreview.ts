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
  buildParentSuffixMap,
  buildEffectiveAnimationAssignment,
  buildSequenceNamingPlan,
} from '../engine/cell-extractor'
import { computeDisplayNames } from '../engine/anim-folder-display-name'
import { flattenTree, compositeRoot } from '../engine/flatten'
import { replaceExtension } from '../utils/image-export'
import {
  makeCellFileName,
  makeCellLabel,
  resolveAnimationSequenceSeparator,
} from '../utils/naming'
import { collectMembersInTreeOrder, buildMemberFlatsWithOverride } from '../utils/virtual-set-utils'
import { resolveSelectedAnimCell } from '../utils/anim-cell-selection'
import { isAutoMarkedContainerOutputSuppressed } from '../utils/auto-marked-container'
import type { CspLayer, OutputEntry, ProjectSettings, OutputConfig, OutputFormat, XdtsData } from '../types'

export interface OutputPreviewEntry {
  canvas: HTMLCanvasElement
  flatName: string
  path: string
}

function replacePreviewExtension(fileName: string, format: OutputFormat): string {
  return fileName ? replaceExtension(fileName, format) : fileName
}

function mapPreviewEntries(entries: OutputEntry[], format: OutputFormat): OutputPreviewEntry[] {
  return entries.map(e => ({
    canvas: e.canvas,
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
export function useOutputPreview(): OutputPreviewEntry[] {
  const layerTree = useAppStore(selectLayerTreeWithVisibility)
  const focusedAnimFolderId = useAppStore(s => s.focusedAnimFolderId)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const virtualSets = useAppStore(s => s.virtualSets)
  const selectedCells = useAppStore(s => s.selectedCells)
  const projectSettings = useAppStore(s => s.projectSettings)
  const outputConfig = useAppStore(s => s.outputConfig)
  const xdtsData = useAppStore(s => s.xdtsData)
  const docWidth = useAppStore(s => s.docWidth)
  const docHeight = useAppStore(s => s.docHeight)

  return useMemo(() => {
    if (docWidth === 0 || docHeight === 0) return []

    // ── 1. 仮想セット選択 ──────────────────────────────────────────────────
    if (selectedVirtualSetId) {
      const vs = virtualSets.find(v => v.id === selectedVirtualSetId)
      if (!vs || vs.members.length === 0) return []

      if (vs.insertionLayerId) {
        // 配置済み: ZIP出力と同じ extractVirtualSetEntries を使用
        const entries = extractVirtualSetEntries(
          layerTree, [vs], docWidth, docHeight, outputConfig.background,
        )
        return mapPreviewEntries(entries, outputConfig.format)
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
      return [{ canvas, flatName: vs.name, path: '' }]
    }

    // ── 2. アニメーションフォルダ選択（直接セルクリック） ──────────────────
    if (focusedAnimFolderId) {
      return previewAnimFolder(
        focusedAnimFolderId,
        selectedCells.get(focusedAnimFolderId),
        null,
        layerTree, projectSettings, outputConfig, xdtsData, docWidth, docHeight,
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
        layerTree, projectSettings, outputConfig, xdtsData, docWidth, docHeight,
      )
    }

    // ── 3b. autoMarked/singleMark（アニメセル外） ──────────────────────────
    // extractAllEntries と同じ collectMarkedLayerContext を使用
    const markedLayer = findLayerById(layerTree, selectedLayerId)
    if (
      markedLayer &&
      !markedLayer.isAnimationFolder &&
      (markedLayer.autoMarked || markedLayer.singleMark) &&
      !isAutoMarkedContainerOutputSuppressed(markedLayer)
    ) {
      const { lower, upper } = collectMarkedLayerContext(selectedLayerId, layerTree, docWidth, docHeight)
      const layerFlats = flattenTree([markedLayer], docWidth, docHeight)
      const canvas = compositeRoot(
        [...lower, ...layerFlats, ...upper], docWidth, docHeight, outputConfig.background,
      )
      const fileName = replacePreviewExtension(`${markedLayer.originalName}.jpg`, outputConfig.format)
      return [{ canvas, flatName: fileName, path: fileName }]
    }

    return []
  }, [
    focusedAnimFolderId, selectedVirtualSetId, selectedLayerId,
    virtualSets, selectedCells, layerTree, projectSettings, outputConfig, xdtsData,
    docWidth, docHeight,
  ])
}

/**
 * 指定アニメーションフォルダの選択セルを extractCells で描画しフィルタリングする。
 *
 * filterSourceLayerId が指定された場合（工程フォルダ直接クリック時）、
 * その sourceLayerId に一致するエントリのみを返す。
 * 一致なしの場合はセル全エントリにフォールバック。
 */
function previewAnimFolder(
  animFolderId: string,
  rawCellIndex: number | undefined,
  filterSourceLayerId: string | null,
  layerTree: CspLayer[],
  projectSettings: ProjectSettings,
  outputConfig: OutputConfig,
  xdtsData: XdtsData | null,
  docWidth: number,
  docHeight: number,
): OutputPreviewEntry[] {
  const animFolder = findLayerById(layerTree, animFolderId)
  if (!animFolder || !animFolder.isAnimationFolder) return []

  const { lower: lowerContextFlats, upper: localUpperFlats } =
    collectLocalSiblingContext(animFolderId, layerTree, docWidth, docHeight)

  const selection = resolveSelectedAnimCell(animFolder, rawCellIndex)
  if (!selection) return []
  const visibleChildren = selection.visibleChildren
  const clampedIndex = selection.visibleIndex
  const selectedCell = selection.cell

  const parentSuffix = resolveParentSuffix(animFolderId, layerTree, projectSettings.processTable)

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
    xdtsData,
    displayNames,
  )

  const allEntries: OutputEntry[] = extractCells(
    animFolder, projectSettings, docWidth, docHeight, lowerContextFlats,
    parentSuffix, displayName, outputConfig.background, localUpperFlats,
    outputConfig.processSuffixPosition,
    sequenceNamingPlan.digits,
    sequenceNamingPlan.sheetSequenceNumbers,
  )

  // 選択セルのエントリに絞り込む
  const namingMode = projectSettings.cellNamingMode ?? 'sequence'
  const isAutoProcessAnim = animFolder.animationFolder?.detectedBy === 'autoProcess'
  const sequenceNumber = sequenceNamingPlan.sheetSequenceNumbers?.get(selectedCell.id)
    ?? visibleChildren.length - clampedIndex
  const cellLabel = isAutoProcessAnim
    ? (selectedCell.name || selectedCell.originalName)
    : makeCellLabel(
        namingMode,
        selectedCell.originalName,
        sequenceNumber,
        sequenceNamingPlan.digits,
      )
  const prefix = makeCellFileName({
    trackName: displayName,
    cellLabel,
    parentSuffix,
    processSuffixPosition: outputConfig.processSuffixPosition,
    trackCellSeparator: resolveAnimationSequenceSeparator(
      isAutoProcessAnim ? 'cellname' : namingMode,
      projectSettings.animationSequenceSeparator ?? 'underscore',
    ),
    suppressDuplicateProcessSuffix: !isAutoProcessAnim && namingMode === 'cellname',
  }).replace(/\.jpg$/i, '')

  let entries = allEntries.filter(e => e.sourceCellId === selectedCell.id)
  if (entries.length === 0) entries = allEntries.filter(e =>
    e.flatName === `${prefix}.jpg` || e.flatName.startsWith(`${prefix}_`),
  )

  // さらに sourceLayerId で絞り込む（工程フォルダ直接選択時）
  if (filterSourceLayerId) {
    const filtered = entries.filter(e => e.sourceLayerId === filterSourceLayerId)
    if (filtered.length > 0) entries = filtered
    // 一致なし（本体レイヤー等）の場合はセル全エントリをフォールバック表示
  }

  return mapPreviewEntries(entries, outputConfig.format)
}

/**
 * レイヤーがアニメーションフォルダのセル内部にある場合、
 * そのアニメフォルダ ID とセルの children インデックスを返す。
 *
 * アニメフォルダの直接の子（isCell=true）ではなく、
 * セルフォルダの内部にあるレイヤー（工程フォルダ等）を対象とする。
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
      if (layer.id === layerId) return ctx
      if (!layer.isFolder) continue

      if (layer.isAnimationFolder) {
        // アニメフォルダの直接の子はセル。その内部を ctx に設定して再帰。
        for (let i = 0; i < layer.children.length; i++) {
          const cell = layer.children[i]
          if (!cell.isFolder) continue
          const result = walk(cell.children, { animFolderId: layer.id, cellChildIndex: i })
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
    if (l.id === id) return l
    const found = findLayerById(l.children, id)
    if (found) return found
  }
  return null
}
