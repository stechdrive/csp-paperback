import type { CspLayer, ProjectSettings } from '../types'
import { normalizeProcessFolderName } from '../utils/process-folder'

export interface CellOutputUnit {
  cell: CspLayer
  /** Index in the original animation folder, including hidden cells. */
  cellIndex: number
  sourceLayerId: string
  /** Absent for the body; an empty suffix is still a distinct process output. */
  processSuffix?: string
  layers: CspLayer[]
  ignoreOpacityIds?: Set<string>
}

/** Map normalized process folder names to their output suffixes. */
export function buildFolderNameToSuffixMap(
  processTable: ProjectSettings['processTable'],
): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of processTable) {
    for (const folderName of entry.folderNames) {
      const normalized = normalizeProcessFolderName(folderName)
      if (normalized) map.set(normalized, entry.suffix)
    }
  }
  return map
}

/** Enumerate the images produced by a folder without creating any canvases. */
export function collectCellOutputUnits(
  animFolder: CspLayer,
  processTable: ProjectSettings['processTable'],
): CellOutputUnit[] {
  if (!animFolder.isAnimationFolder) return []

  const folderNameToSuffix = buildFolderNameToSuffixMap(processTable)
  const units: CellOutputUnit[] = []

  for (const [cellIndex, cell] of animFolder.children.entries()) {
    if (cell.hidden || cell.uiHidden) continue
    if (!cell.isFolder) {
      units.push({ cell, cellIndex, sourceLayerId: cell.id, layers: [cell], ignoreOpacityIds: new Set([cell.id]) })
      continue
    }

    const bodyLayers: CspLayer[] = []
    const processGroups = new Map<string, CspLayer[]>()
    for (const sub of cell.children) {
      if (sub.hidden || sub.uiHidden) continue
      const suffix = sub.isFolder
        ? folderNameToSuffix.get(normalizeProcessFolderName(sub.originalName))
        : undefined
      if (suffix === undefined) {
        bodyLayers.push(sub)
      } else {
        const group = processGroups.get(suffix) ?? []
        group.push(sub)
        processGroups.set(suffix, group)
      }
    }

    // An empty cell still produces its body/context image.
    if (bodyLayers.length > 0 || processGroups.size === 0) {
      units.push({ cell, cellIndex, sourceLayerId: cell.id, layers: bodyLayers })
    }
    for (const [processSuffix, layers] of processGroups) {
      units.push({ cell, cellIndex, sourceLayerId: layers[0].id, processSuffix, layers, ignoreOpacityIds: new Set(layers.map(layer => layer.id)) })
    }
  }

  return units
}
