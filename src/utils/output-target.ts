import type { CspLayer, OutputConfig, ProjectSettings } from '../types'
import type { CellOutputUnit } from '../engine/cell-output-units'
import { normalizeProcessFolderName } from './process-folder'

/** Output selection is separate from canvas visibility and material compositing. */
export interface OutputTarget {
  body: boolean
  processSuffixes: string[]
  individualName?: string
  /** Preserve the meaning of the old global switch when loading saved settings. */
  legacyAutoMarked?: boolean
  /** A name-matched process may also have been excluded by the old global switch. */
  legacyIndividualName?: string
}

/** Archive branches stay available as artwork and for explicit user marks. */
export function isAutomaticOutputSuppressed(layer: CspLayer): boolean {
  return layer.individualOutputExcludedBy !== undefined
    && !layer.singleMark && layer.animationFolder?.detectedBy !== 'manual'
}

export function individualOutputName(name: string): string {
  return name.trim().replace(/^_/, '') || name
}

export function individualOutputKey(name: string): string {
  return normalizeProcessFolderName(name)
}

function matchingProcess(name: string, table: ProjectSettings['processTable']): string | undefined {
  const key = normalizeProcessFolderName(name)
  return table.find(entry => entry.folderNames.some(alias => normalizeProcessFolderName(alias) === key))?.suffix
}

export function cellOutputTarget(
  folder: CspLayer,
  unit: Pick<CellOutputUnit, 'cell' | 'processSuffix'>,
  table: ProjectSettings['processTable'],
  parentSuffix?: string,
): OutputTarget {
  const individualName = folder.animationFolder?.detectedBy === 'autoProcess'
    ? individualOutputName(folder.originalName) : undefined
  const suffixes = [parentSuffix, unit.processSuffix,
    individualName && unit.cell.isFolder ? matchingProcess(unit.cell.originalName, table) : undefined]
  const processSuffixes = [...new Set(suffixes.filter((suffix): suffix is string => suffix !== undefined))]
  return { body: !individualName && processSuffixes.length === 0, processSuffixes, individualName }
}

export function individualOutputTarget(layer: CspLayer, table: ProjectSettings['processTable']): OutputTarget {
  const suffix = layer.isFolder ? matchingProcess(layer.originalName, table) : undefined
  const legacyAutoMarked = layer.autoMarked && !layer.singleMark
  const name = individualOutputName(layer.originalName)
  return { body: false, processSuffixes: suffix === undefined ? [] : [suffix],
    individualName: suffix === undefined ? name : undefined,
    legacyIndividualName: suffix !== undefined && legacyAutoMarked ? name : undefined,
    legacyAutoMarked }
}

export function isIndividualOutputEnabled(target: OutputTarget, config: OutputConfig): boolean {
  const name = target.individualName ?? target.legacyIndividualName
  if (name === undefined) return true
  const key = individualOutputKey(name)
  const overrides = config.individualOutputOverrides
  return overrides && Object.hasOwn(overrides, key)
    ? overrides[key] : !(target.legacyAutoMarked && config.excludeAutoMarked)
}

/** Shared by export, file list, navigation and tree indicators. */
export function isOutputTargetExcluded(target: OutputTarget | undefined, config: OutputConfig): boolean {
  if (!target) return false
  return (!!config.excludeBody && target.body)
    || target.processSuffixes.some(suffix => config.excludedProcessSuffixes.includes(suffix))
    || !isIndividualOutputEnabled(target, config)
}
