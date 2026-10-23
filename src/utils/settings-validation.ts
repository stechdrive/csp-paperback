import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS, normalizeBodyGroupName, resolveCellPrefixSeparator,
  type OutputConfig, type ProcessFolderEntry, type ProjectSettings } from '../types'
import { normalizeProcessTable } from './process-table'

export const MAX_SETTINGS_JSON_LENGTH = 1024 * 1024
const maxItems = 4096, maxStringLength = 4096
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const string = (value: unknown): value is string => typeof value === 'string' && value.length <= maxStringLength
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.length <= maxItems && value.every(string)
const boolean = (value: unknown): value is boolean => typeof value === 'boolean'
const oneOf = <T extends string>(...values: T[]) => (value: unknown): value is T => values.includes(value as T)

function fields(value: unknown, strict: boolean) {
  if (strict && !record(value)) throw new Error('設定JSONはオブジェクトで指定してください')
  const input = record(value) ? value : {}
  return <T>(name: string, valid: (v: unknown) => v is T, fallback: T): T => {
    const value = input[name]
    if (value === undefined) return fallback
    if (valid(value)) return value
    if (strict) throw new Error(`設定「${name}」の形式または長さが不正です`)
    return fallback
  }
}

const processTable = (value: unknown): value is ProcessFolderEntry[] => Array.isArray(value) && value.length <= maxItems && value.every(entry =>
  record(entry) && string(entry.suffix) && strings(entry.folderNames) &&
  (entry.displayName === undefined || string(entry.displayName)) &&
  (entry.revisionBorderColor === undefined || string(entry.revisionBorderColor)))

/** Explicit imports reject invalid fields atomically; saved legacy settings recover per field. */
export function validateProjectSettings(value: unknown, strict = false): ProjectSettings {
  const field = fields(value, strict), defaults = DEFAULT_PROJECT_SETTINGS
  const separators = {
    cellPrefixSeparator: field('cellPrefixSeparator', oneOf('underscore', 'none'), undefined),
    animationSequenceSeparator: field('animationSequenceSeparator', oneOf('underscore', 'none'), undefined),
  }
  const separator = resolveCellPrefixSeparator(separators)
  return {
    bodyGroupName: normalizeBodyGroupName(field('bodyGroupName', string, defaults.bodyGroupName)),
    processTable: normalizeProcessTable(field('processTable', processTable, defaults.processTable).map(entry => ({
      suffix: entry.suffix, folderNames: entry.folderNames, displayName: entry.displayName, revisionBorderColor: entry.revisionBorderColor,
    }))),
    cellNamingMode: field('cellNamingMode', oneOf('sequence', 'sequence-cellname', 'cellname', 'sheet-sequence'), defaults.cellNamingMode),
    sequenceDigitMode: field('sequenceDigitMode', oneOf('auto', 'fixed-4'), defaults.sequenceDigitMode),
    cellPrefixSeparator: separator, animationSequenceSeparator: separator,
    includeXdtsTrackPrefixInCellName: field('includeXdtsTrackPrefixInCellName', boolean, true),
    sharedCutMode: field('sharedCutMode', boolean, false),
    showIndividualFoldersOnLoad: field('showIndividualFoldersOnLoad', boolean, true),
    autoMarkFolderNames: field('autoMarkFolderNames', strings, defaults.autoMarkFolderNames),
    archivePatterns: field('archivePatterns', strings, defaults.archivePatterns),
  }
}

export function validateOutputConfig(value: unknown): OutputConfig {
  const field = fields(value, false), defaults = DEFAULT_OUTPUT_CONFIG
  const overrides = (v: unknown): v is Record<string, boolean> => record(v) && Object.keys(v).length <= maxItems &&
    Object.entries(v).every(([key, value]) => string(key) && boolean(value))
  return {
    format: field('format', oneOf('jpg', 'png'), defaults.format),
    jpgQuality: field('jpgQuality', (v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1, defaults.jpgQuality),
    background: field('background', oneOf('white', 'transparent'), defaults.background),
    structure: field('structure', oneOf('hierarchy', 'flat'), defaults.structure),
    processSuffixPosition: field('processSuffixPosition', oneOf('after-cell', 'before-cell'), defaults.processSuffixPosition),
    excludedProcessSuffixes: field('excludedProcessSuffixes', strings, defaults.excludedProcessSuffixes),
    excludeAutoMarked: field('excludeAutoMarked', boolean, defaults.excludeAutoMarked),
    excludeBody: field('excludeBody', boolean, false),
    individualOutputOverrides: Object.fromEntries(Object.entries(field('individualOutputOverrides', overrides, {}))),
    revisionBorderEnabled: field('revisionBorderEnabled', boolean, defaults.revisionBorderEnabled),
  }
}
