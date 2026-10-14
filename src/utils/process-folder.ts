import type { ProcessFolderEntry } from '../types/project'

/**
 * 工程辞書の照合キー。半角・全角スペース等の前後空白と大小文字を無視する。
 * 元のフォルダ名・名前の途中の空白・出力サフィックスは変更しない。
 */
export function normalizeProcessFolderName(name: string): string {
  return name.trim().toLowerCase()
}

/** The display name never changes matching aliases or output filenames. */
export function processDisplayName(entry: ProcessFolderEntry): string {
  return entry.displayName?.trim() || '修正工程'
}
