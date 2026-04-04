import type { AnimationFolderMode } from './animation'

export interface ProcessFolderEntry {
  suffix: string           // 例: '_en'
  folderNames: string[]    // 例: ['EN', '演出修正', 'ens', '演修']
}

export interface ProjectSettings {
  processTable: ProcessFolderEntry[]
  sequenceDigits: number   // デフォルト4
  defaultMode: AnimationFolderMode
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  processTable: [],
  sequenceDigits: 4,
  defaultMode: 'cell-inclusive',
}
