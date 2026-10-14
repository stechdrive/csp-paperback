import { DEFAULT_PROJECT_SETTINGS, type ProcessFolderEntry } from '../types/project'
import { normalizeProcessFolderName } from './process-folder'
import { resolveProcessBorderColor } from './process-color'

/** Fill missing legacy group names once, independently of later alias edits. */
export function normalizeProcessTable(table: ProcessFolderEntry[]): ProcessFolderEntry[] {
  return table.map((entry, index) => {
    const aliases = entry.folderNames.map(normalizeProcessFolderName)
    const defaults = DEFAULT_PROJECT_SETTINGS.processTable
    const defaultGroup = defaults.find(group => group.suffix === normalizeProcessFolderName(entry.suffix))
      ?? defaults.find(group => group.folderNames.some(name => aliases.includes(normalizeProcessFolderName(name))))
    const legacyName = entry.folderNames.find(name => name.trim() && !name.trim().startsWith('_'))?.trim()
      || entry.folderNames.map(name => name.trim().replace(/^_+/, '')).find(Boolean)
    return {
      ...entry,
      displayName: entry.displayName?.trim() || defaultGroup?.displayName || legacyName || `修正工程 ${index + 1}`,
      folderNames: [...entry.folderNames],
      revisionBorderColor: resolveProcessBorderColor(entry),
    }
  })
}
