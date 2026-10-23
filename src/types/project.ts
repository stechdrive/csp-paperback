export interface ProcessFolderEntry {
  /** 工程グループ名。未設定の旧JSONでは読み込み時に補完して保存する */
  displayName?: string
  suffix: string           // 例: '_en'
  folderNames: string[]    // 例: ['EN', '演出修正', 'ens', '演修']
  /** 修正工程フチに使う色。旧設定JSONとの互換のため省略を許可する */
  revisionBorderColor?: string
}

/** セル画像名の命名モード */
export type CellNamingMode =
  | 'sequence'   // アニメフォルダ名 + 連番（初期設定の区切りあり・自動桁数なら例: A_1.jpg）
  | 'sequence-cellname' // アニメフォルダ名 + 連番 + セル名（例: A1_ア.jpg）
  | 'cellname'   // CSPのセル名を使用。必要に応じてアニメフォルダ名を付加（例: A1.jpg）
  | 'sheet-sequence' // 同名セル系列をXDTS初出順で工程込み連番化（例: A1.jpg）

/** 連番のゼロ埋め桁数 */
export type SequenceDigitMode = 'auto' | 'fixed-4'

/** ファイル名のプレフィックス部分とセル部分の区切り */
export type CellPrefixSeparator = 'underscore' | 'none'

/** @deprecated 旧設定JSONとの互換用。新規コードでは CellPrefixSeparator を使う */
export type AnimationSequenceSeparator = CellPrefixSeparator

export interface ProjectSettings {
  processTable: ProcessFolderEntry[]
  /** 工程に属さないセル画像の表示名。分類や出力名には使わない */
  bodyGroupName?: string
  cellNamingMode: CellNamingMode
  /** auto: 出力全体の最大連番に合わせる（最低1桁） / fixed-4: 常に4桁 */
  sequenceDigitMode: SequenceDigitMode
  /** アニメーションフォルダ名を付ける場合、セル部分の直前に _ を入れるか */
  cellPrefixSeparator?: CellPrefixSeparator
  /** @deprecated 旧設定JSONとの互換用 */
  animationSequenceSeparator?: AnimationSequenceSeparator
  /** セル名モードのXDTS検出フォルダで、ファイル名へフォルダ名を付けるか */
  includeXdtsTrackPrefixInCellName?: boolean
  /** 兼用カット: XDTS未使用セルを初期OFFにせず、XDTS検出アニメフォルダ自体を表示ONにする */
  sharedCutMode?: boolean
  /** 個別書き出し対象の非表示フォルダを、読み込み時に表示ONにする */
  showIndividualFoldersOnLoad?: boolean
  /** _プレフィックス以外に単体出力として自動マークするフォルダ名（完全一致） */
  autoMarkFolderNames: string[]
  /** 自動出力検出・自動表示から配下ごと除外するパターン（前方一致）。デフォルト: ['_old', '_pool'] */
  archivePatterns: string[]
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  bodyGroupName: '作画',
  processTable: [
    { displayName: '演出', suffix: '_e', folderNames: ['_e', '演出'], revisionBorderColor: '#FBECE6' },
    { displayName: '監督', suffix: '_k',  folderNames: ['_k',  '監督'], revisionBorderColor: '#DCE4F1' },
    { displayName: '作監', suffix: '_s',  folderNames: ['_s',  '作監'], revisionBorderColor: '#FCF9CF' },
    { displayName: 'その他修正', suffix: '_y',  folderNames: ['_y',  '料理作監'], revisionBorderColor: '#FFDDAA' },
    { displayName: '総作監', suffix: '_ss', folderNames: ['_ss', '総作監'], revisionBorderColor: '#EAF6D5' },
  ],
  cellNamingMode: 'cellname',
  sequenceDigitMode: 'auto',
  cellPrefixSeparator: 'underscore',
  animationSequenceSeparator: 'underscore',
  includeXdtsTrackPrefixInCellName: true,
  sharedCutMode: false,
  showIndividualFoldersOnLoad: true,
  autoMarkFolderNames: ['撮影指示', '原図'],
  archivePatterns: ['_old', '_pool'],
}

export function normalizeBodyGroupName(name?: string): string {
  return name?.trim() || '作画'
}

/** 新旧どちらの設定形式からも、セル部分直前の区切り設定を解決する。 */
export function resolveCellPrefixSeparator(
  settings: Pick<ProjectSettings, 'cellPrefixSeparator' | 'animationSequenceSeparator'>,
): CellPrefixSeparator {
  if (settings.cellPrefixSeparator === 'underscore' || settings.cellPrefixSeparator === 'none') {
    return settings.cellPrefixSeparator
  }
  if (
    settings.animationSequenceSeparator === 'underscore'
    || settings.animationSequenceSeparator === 'none'
  ) {
    return settings.animationSequenceSeparator
  }
  return DEFAULT_PROJECT_SETTINGS.cellPrefixSeparator ?? 'underscore'
}

/** 未設定の旧データでは従来どおりXDTSフォルダ名を付ける。 */
export function resolveIncludeXdtsTrackPrefixInCellName(
  settings: Pick<ProjectSettings, 'includeXdtsTrackPrefixInCellName'>,
): boolean {
  return settings.includeXdtsTrackPrefixInCellName !== false
}
