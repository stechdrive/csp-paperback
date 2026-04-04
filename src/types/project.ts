export interface ProcessFolderEntry {
  suffix: string           // 例: '_en'
  folderNames: string[]    // 例: ['EN', '演出修正', 'ens', '演修']
}

/** セルファイル名の命名モード */
export type CellNamingMode =
  | 'sequence'   // アニメフォルダ名_連番4桁.jpg（例: A_0001.jpg）
  | 'cellname'   // アニメフォルダ名_セル名.jpg（例: A_A0001.jpg）

export interface ProjectSettings {
  processTable: ProcessFolderEntry[]
  cellNamingMode: CellNamingMode
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  processTable: [],
  cellNamingMode: 'sequence',
}
