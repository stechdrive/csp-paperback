import type { ProcessFolderEntry } from '../types'

export const DEFAULT_REVISION_BORDER_COLOR = '#FBECE6'

const DEFAULT_COLOR_BY_SUFFIX = new Map<string, string>([
  ['_e', '#FBECE6'],
  ['_k', '#DCE4F1'],
  ['_s', '#FCF9CF'],
  ['_ss', '#EAF6D5'],
  ['_y', '#FFDDAA'],
])

const DEFAULT_COLOR_BY_FOLDER_NAME = new Map<string, string>([
  ['演出', '#FBECE6'],
  ['監督', '#DCE4F1'],
  ['作監', '#FCF9CF'],
  ['総作監', '#EAF6D5'],
  ['料理作監', '#FFDDAA'],
])

export function normalizeHexColor(value: string | undefined): string | null {
  if (!value) return null
  const hex = value.trim().replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null
  return `#${hex.toUpperCase()}`
}

export function resolveProcessBorderColor(entry: ProcessFolderEntry): string {
  return normalizeHexColor(entry.revisionBorderColor)
    ?? DEFAULT_COLOR_BY_SUFFIX.get(entry.suffix.trim().toLowerCase())
    ?? entry.folderNames
      .map(name => DEFAULT_COLOR_BY_FOLDER_NAME.get(name.trim().toLowerCase()))
      .find((color): color is string => !!color)
    ?? DEFAULT_REVISION_BORDER_COLOR
}

export function normalizeProcessTableColors(
  table: ProcessFolderEntry[],
): ProcessFolderEntry[] {
  return table.map(entry => ({
    ...entry,
    folderNames: [...entry.folderNames],
    revisionBorderColor: resolveProcessBorderColor(entry),
  }))
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex) ?? DEFAULT_REVISION_BORDER_COLOR
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()
  return `#${channel(r)}${channel(g)}${channel(b)}`
}
