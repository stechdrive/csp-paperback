import type { CspLayer, OutputConfig, ProjectSettings, VirtualSet } from '../types'
import { buildParentSuffixMap, hasVirtualSetOutput } from '../engine/cell-extractor'
import { collectCellOutputUnits } from '../engine/cell-output-units'
import { isAutoMarkedContainerOutputSuppressed } from './auto-marked-container'
import { findLayerPath } from './layerNavigation'
import { cellOutputTarget, individualOutputTarget, isAutomaticOutputSuppressed, isOutputTargetExcluded, type OutputTarget } from './output-target'

export interface OutputNavigationEntry {
  id: string
  kind: 'layer' | 'virtualSet'
  label: string
  ancestorIds: string[]
  animFolderId?: string
  cellIndex?: number
  /** Layers that belong to this image, including merged process folders. */
  memberIds: Set<string>
  outputTarget?: OutputTarget
}

export interface OutputNavigation {
  entries: OutputNavigationEntry[]
  rowPositions: Map<string, number>
}

function collectIds(layers: CspLayer[], result = new Set<string>()): Set<string> {
  for (const layer of layers) {
    result.add(layer.id)
    collectIds(layer.children, result)
  }
  return result
}

/** Enumerate export images in tree order without rendering them or expanding folders. */
export function collectOutputNavigation(
  tree: CspLayer[],
  projectSettings: ProjectSettings,
  outputConfig: OutputConfig,
  virtualSets: VirtualSet[],
  options: { includeHidden?: boolean; includeExcluded?: boolean; outputAliases?: ReadonlyMap<string, string> } = {},
): OutputNavigation {
  const rowPositions = new Map<string, number>()
  const ancestors = new Map<string, string[]>()
  const positionVirtualSets = (layerId: string, position: 'above' | 'below', path: string[]) => {
    for (const vs of virtualSets) {
      if (vs.insertionLayerId !== layerId || vs.insertionPosition !== position) continue
      rowPositions.set(vs.id, rowPositions.size)
      ancestors.set(vs.id, path)
    }
  }
  const indexRows = (layers: CspLayer[], path: string[]) => {
    for (const layer of layers) {
      positionVirtualSets(layer.id, 'above', path)
      rowPositions.set(layer.id, rowPositions.size)
      ancestors.set(layer.id, path)
      indexRows(layer.children, [...path, layer.id])
      positionVirtualSets(layer.id, 'below', path)
    }
  }
  indexRows(tree, [])

  const entries: OutputNavigationEntry[] = []
  const parentSuffixes = buildParentSuffixMap(tree, projectSettings.processTable)
  const walk = (layers: CspLayer[]) => {
    for (const layer of layers) {
      if (!options.includeHidden && (layer.hidden || layer.uiHidden)) continue
      if (isAutomaticOutputSuppressed(layer)) {
        walk(layer.children)
        continue
      }
      if (layer.isAnimationFolder) {
        for (const unit of collectCellOutputUnits(layer, projectSettings.processTable, options)) {
          const outputTarget = cellOutputTarget(layer, unit, projectSettings.processTable, parentSuffixes.get(layer.id))
          if (!options.includeExcluded && isOutputTargetExcluded(outputTarget, outputConfig)) continue
          const label = `${options.outputAliases?.get(layer.id) ?? layer.name} / ${unit.cell.name}${unit.processSuffix !== undefined ? ` / ${unit.layers.map(l => l.name).join(' + ')}` : ''}`
          entries.push({
            id: unit.sourceLayerId,
            kind: 'layer',
            label,
            ancestorIds: ancestors.get(unit.sourceLayerId) ?? [],
            animFolderId: layer.id,
            cellIndex: unit.cellIndex,
            memberIds: collectIds(unit.layers),
            outputTarget,
          })
        }
        continue
      }
      if ((layer.singleMark || layer.autoMarked) &&
        !isAutoMarkedContainerOutputSuppressed(layer, options.includeHidden)) {
        const outputTarget = individualOutputTarget(layer, projectSettings.processTable)
        if (options.includeExcluded || !isOutputTargetExcluded(outputTarget, outputConfig)) {
          entries.push({ id: layer.id, kind: 'layer', label: options.outputAliases?.get(layer.id) ?? layer.name, outputTarget,
            ancestorIds: ancestors.get(layer.id) ?? [], memberIds: collectIds([layer]) })
        }
      }
      walk(layer.children)
    }
  }
  walk(tree)

  // Virtual cells are exported independently of their insertion row's visibility.
  for (const vs of virtualSets) {
    if (!hasVirtualSetOutput(tree, vs)) continue
    if (!rowPositions.has(vs.id)) rowPositions.set(vs.id, rowPositions.size)
    entries.push({ id: vs.id, kind: 'virtualSet', label: vs.name,
      ancestorIds: ancestors.get(vs.id) ?? [], memberIds: new Set() })
  }
  entries.sort((a, b) => rowPositions.get(a.id)! - rowPositions.get(b.id)!)
  return { entries, rowPositions }
}

/** Resolve a content-layer click to its containing output, preferring nested marked outputs. */
export function findOutputNavigationIndex(
  entries: OutputNavigationEntry[],
  selectedLayerId: string | null,
  selectedVirtualSetId: string | null,
): number {
  if (selectedVirtualSetId) return entries.findIndex(e => e.kind === 'virtualSet' && e.id === selectedVirtualSetId)
  if (!selectedLayerId) return -1
  const exact = entries.findIndex(e => e.kind === 'layer' && e.id === selectedLayerId)
  if (exact >= 0) return exact
  return entries.findLastIndex(e => e.kind === 'layer' && e.memberIds.has(selectedLayerId))
}

export function nextOutputNavigationIndex(
  navigation: OutputNavigation,
  selectedLayerId: string | null,
  selectedVirtualSetId: string | null,
  direction: 1 | -1,
): number {
  const { entries, rowPositions } = navigation
  if (entries.length === 0) return -1
  const current = findOutputNavigationIndex(entries, selectedLayerId, selectedVirtualSetId)
  if (current >= 0) return Math.max(0, Math.min(entries.length - 1, current + direction))
  const position = rowPositions.get(selectedVirtualSetId ?? selectedLayerId ?? '')
  if (position !== undefined) {
    const next = direction > 0
      ? entries.findIndex(e => rowPositions.get(e.id)! > position)
      : entries.findLastIndex(e => rowPositions.get(e.id)! < position)
    if (next >= 0) return next
    return direction > 0 ? entries.length - 1 : 0
  }
  return direction > 0 ? 0 : entries.length - 1
}

/** Reveal only the path to output rows; never open their artwork-only contents. */
export function collectOutputRevealFolders(
  tree: CspLayer[],
  navigation: OutputNavigation,
  selectedLayerId: string | null,
  selectedVirtualSetId: string | null = null,
): Set<string> {
  if (selectedVirtualSetId) {
    return new Set(navigation.entries.find(e => e.kind === 'virtualSet' && e.id === selectedVirtualSetId)?.ancestorIds ?? [])
  }
  if (!selectedLayerId) return new Set()
  const path = findLayerPath(tree, selectedLayerId)
  const result = new Set(path.slice(0, -1).filter(layer => layer.isFolder).map(layer => layer.id))
  const layer = path.at(-1)
  if (layer?.isAnimationFolder) result.add(layer.id)
  // A cell body can also contain separate process outputs. Show those endpoints
  // while the body is selected so the tree communicates the remaining images.
  if (navigation.entries.some(e => e.kind === 'layer' && e.id === selectedLayerId)) {
    for (const entry of navigation.entries) {
      const index = entry.ancestorIds.indexOf(selectedLayerId)
      if (index >= 0) entry.ancestorIds.slice(index).forEach(id => result.add(id))
    }
  }
  return result
}
