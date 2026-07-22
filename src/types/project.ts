export interface ProcessFolderEntry {
  suffix: string           // 例: '_en'
  folderNames: string[]    // 例: ['EN', '演出修正', 'ens', '演修']
  /** 修正工程フチに使う色。旧設定JSONとの互換のため省略を許可する */
  revisionBorderColor?: string
}

/** セル画像名の命名モード */
export type CellNamingMode =
  | 'sequence'   // アニメフォルダ名_連番4桁.jpg（例: A_0001.jpg）
  | 'sequence-cellname' // アニメフォルダ名_連番_セル名.jpg（例: A_01_ア.jpg）
  | 'cellname'   // アニメフォルダ名_セル名.jpg（例: A_A0001.jpg）
  | 'sheet-sequence' // 同名セル系列をXDTS初出順で工程込み連番化（例: A_0001.jpg）

/** 連番のゼロ埋め桁数 */
export type SequenceDigitMode = 'auto' | 'fixed-4'

/** アニメーションフォルダ名（工程名を前に置く場合は工程名）と連番の区切り */
export type AnimationSequenceSeparator = 'underscore' | 'none'

export interface ProjectSettings {
  processTable: ProcessFolderEntry[]
  cellNamingMode: CellNamingMode
  /** auto: 出力全体の最大連番に合わせる（最低2桁） / fixed-4: 常に4桁 */
  sequenceDigitMode: SequenceDigitMode
  /** 連番の直前に _ を入れるか */
  animationSequenceSeparator: AnimationSequenceSeparator
  /** 兼用カット: XDTS未使用セルを初期OFFにせず、XDTS検出アニメフォルダ自体を表示ONにする */
  sharedCutMode?: boolean
  /** _プレフィックス以外に単体出力として自動マークするフォルダ名（完全一致） */
  autoMarkFolderNames: string[]
  /** 自動マーク・自動表示から除外するパターン（前方一致）。デフォルト: ['_old', '_pool'] */
  archivePatterns: string[]
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  processTable: [
    { suffix: '_e', folderNames: ['_e', '演出'], revisionBorderColor: '#FBECE6' },
    { suffix: '_k',  folderNames: ['_k',  '監督'], revisionBorderColor: '#DCE4F1' },
    { suffix: '_s',  folderNames: ['_s',  '作監'], revisionBorderColor: '#FCF9CF' },
    { suffix: '_y',  folderNames: ['_y',  '料理作監'], revisionBorderColor: '#FFDDAA' },
    { suffix: '_ss', folderNames: ['_ss', '総作監'], revisionBorderColor: '#EAF6D5' },
  ],
  cellNamingMode: 'sequence',
  sequenceDigitMode: 'auto',
  animationSequenceSeparator: 'underscore',
  sharedCutMode: false,
  autoMarkFolderNames: ['撮影指示', '原図'],
  archivePatterns: ['_old', '_pool'],
}
