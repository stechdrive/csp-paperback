import { useMemo } from 'react'
import { useAppStore } from '../store'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import { extractCells, resolveParentSuffix, collectContextSourceLayers, collectLocalSiblingContext } from '../engine/cell-extractor'
import { flattenTree, compositeRoot } from '../engine/flatten'
import { collectMembersInTreeOrder, buildMemberFlatsWithOverride } from '../utils/virtual-set-utils'
import type { CspLayer, OutputEntry } from '../types'

export interface OutputPreviewEntry {
  canvas: HTMLCanvasElement
  flatName: string
  path: string
}

/**
 * focusedAnimFolderIdのアニメーションフォルダについて、
 * 選択中のセルの出力エントリ（canvas + ファイル名）を返す。
 *
 * コンテキストは2層構造:
 * - グローバル: アニメ子孫を持たないルート直下レイヤー群（レイアウト用紙・背景原図等）
 * - ローカル: フォーカス中フォルダと同じアニメ包含フォルダ内の兄弟非アニメレイヤー群
 */
export function useOutputPreview(): OutputPreviewEntry[] {
  const layerTree = useAppStore(selectLayerTreeWithVisibility)
  const focusedAnimFolderId = useAppStore(s => s.focusedAnimFolderId)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const virtualSets = useAppStore(s => s.virtualSets)
  const selectedCells = useAppStore(s => s.selectedCells)
  const projectSettings = useAppStore(s => s.projectSettings)
  const outputConfig = useAppStore(s => s.outputConfig)
  const docWidth = useAppStore(s => s.docWidth)
  const docHeight = useAppStore(s => s.docHeight)

  return useMemo(() => {
    if (docWidth === 0 || docHeight === 0) return []

    // 仮想セット選択時のプレビュー
    if (selectedVirtualSetId) {
      const vs = virtualSets.find(v => v.id === selectedVirtualSetId)
      if (!vs || vs.members.length === 0) return []
      const memberIdSet = new Set(vs.members.map(m => m.layerId))
      const memberLayers = collectMembersInTreeOrder(layerTree, memberIdSet)
      if (memberLayers.length === 0) return []
      const contextFlats = flattenTree(collectContextSourceLayers(layerTree), docWidth, docHeight)

      // メンバーごとに blendMode override と visibilityOverrides を適用
      const memberFlats = buildMemberFlatsWithOverride(vs.members, memberLayers, docWidth, docHeight, vs.visibilityOverrides)

      const canvas = compositeRoot([...contextFlats, ...memberFlats], docWidth, docHeight, outputConfig.background)
      return [{ canvas, flatName: vs.name, path: '' }]
    }

    if (!focusedAnimFolderId) return []

    const animFolder = findLayerById(layerTree, focusedAnimFolderId)
    if (!animFolder || !animFolder.isAnimationFolder) return []

    // グローバルコンテキスト（アニメ子孫フォルダを含まないルート直下レイヤー群）
    const contextSourceLayers = collectContextSourceLayers(layerTree)
    const contextFlats = flattenTree(contextSourceLayers, docWidth, docHeight)

    // ローカルコンテキスト（フォーカス中アニメフォルダの兄弟非アニメレイヤー群）
    // lower: アニメフォルダより下にある兄弟 → セルの下に合成
    // upper: アニメフォルダより上にある兄弟 → セルの上に合成
    const { lower: localLowerFlats, upper: localUpperFlats } =
      collectLocalSiblingContext(focusedAnimFolderId, layerTree, docWidth, docHeight)
    const lowerContextFlats = localLowerFlats.length > 0
      ? [...contextFlats, ...localLowerFlats]
      : contextFlats

    // 選択中のセルを特定
    const cellIndex = selectedCells.get(focusedAnimFolderId) ?? 0
    const visibleChildren = animFolder.children.filter(c => !c.hidden && !c.uiHidden)
    if (visibleChildren.length === 0) return []

    const clampedIndex = Math.min(cellIndex, visibleChildren.length - 1)
    const selectedCell = visibleChildren[clampedIndex]

    // ルート直下の親フォルダに基づくparentSuffixを解決
    const parentSuffix = resolveParentSuffix(
      focusedAnimFolderId, layerTree, projectSettings.processTable
    )

    // 全セルを抽出して選択セル分だけフィルタリング
    const allEntries: OutputEntry[] = extractCells(
      animFolder, projectSettings, docWidth, docHeight, lowerContextFlats,
      parentSuffix, undefined, outputConfig.background,
      localUpperFlats,
    )

    // 連番モード: clampedIndex+1 を4桁ゼロ埋め / セル名モード: originalName
    const namingMode = projectSettings.cellNamingMode ?? 'sequence'
    const cellLabel = namingMode === 'sequence'
      ? String(clampedIndex + 1).padStart(4, '0')
      : selectedCell.originalName
    const prefix = `${animFolder.originalName}_${cellLabel}${parentSuffix}`

    const entries = allEntries.filter(e =>
      e.flatName === `${prefix}.jpg` ||
      e.flatName.startsWith(`${prefix}_`)
    )

    return entries.map(e => ({ canvas: e.canvas, flatName: e.flatName, path: e.path }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedAnimFolderId, selectedVirtualSetId, virtualSets, selectedCells, layerTree, projectSettings, outputConfig, docWidth, docHeight])
}

function findLayerById(layers: CspLayer[], id: string): CspLayer | null {
  for (const l of layers) {
    if (l.id === id) return l
    const found = findLayerById(l.children, id)
    if (found) return found
  }
  return null
}
