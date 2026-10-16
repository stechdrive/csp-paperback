import type { CspLayer, OutputConfig, ProjectSettings, VirtualSet } from '../types'
import type { PlannedOutputEntry } from '../engine/cell-extractor'
import { resolveProcessBorderColor } from './process-color'
import { virtualOutputId } from './output-identity'

// Appearance edits, visibility/mark changes and document loads replace the tree.
// Weak keys do not keep old documents alive after the preview cache evicts them.
const treeIds = new WeakMap<CspLayer[], number>()
let nextTreeId = 0

/** Image identity deliberately excludes filenames, encoding and output filtering. */
export function createOutputRenderKey(
  tree: CspLayer[], width: number, height: number, background: OutputConfig['background'],
  virtualSets: VirtualSet[], processTable: ProjectSettings['processTable'] = [], border = false,
): (plan: Pick<PlannedOutputEntry, 'outputId' | 'processSuffixes'>) => string {
  let treeId = treeIds.get(tree)
  if (treeId === undefined) { treeId = ++nextTreeId; treeIds.set(tree, treeId) }
  const scene = JSON.stringify([treeId, width, height, background,
    processTable.map(entry => [entry.suffix, entry.folderNames])])
  const virtualImages = new Map(virtualSets.map(vs => [virtualOutputId(vs.id), JSON.stringify([
    vs.insertionLayerId, vs.insertionPosition, vs.members, vs.visibilityOverrides,
    vs.layerOverrides ?? {}, vs.expandToAnimationCells,
  ])]))
  const colors = new Map(border ? processTable.map(entry => [entry.suffix, resolveProcessBorderColor(entry)]) : [])
  return plan => {
    const suffix = [...(plan.processSuffixes ?? [])].reverse().find(value => colors.has(value))
    return JSON.stringify([scene, plan.outputId, virtualImages.get(plan.outputId), suffix ? colors.get(suffix) : null])
  }
}
