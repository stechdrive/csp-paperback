import { describe, expect, it, vi } from 'vitest'

vi.mock('../../store', () => ({
  useAppStore: { getState: vi.fn() },
}))

vi.mock('../../platform/files', () => ({
  allowTauriLaunchFilePaths: vi.fn(),
  loadableFilesFromPaths: vi.fn(),
}))

vi.mock('../../utils/export-entries', () => ({
  buildOutputEntriesFromState: vi.fn(),
}))

vi.mock('../../utils/directory-builder', () => ({
  saveEntriesToDirectoryPath: vi.fn(),
}))

import { resolveQuickExportFilePair } from '../../utils/quick-export'

describe('resolveQuickExportFilePair', () => {
  it('PSDとXDTSを1つずつ同じ起動引数から解決する', () => {
    expect(resolveQuickExportFilePair([
      String.raw`C:\work\cut001\cut001.psd`,
      String.raw`C:\work\cut001\cut001.xdts`,
    ])).toEqual({
      psdPath: String.raw`C:\work\cut001\cut001.psd`,
      xdtsPath: String.raw`C:\work\cut001\cut001.xdts`,
    })
  })

  it('対象ファイルがなければ通常起動として扱う', () => {
    expect(resolveQuickExportFilePair(['--flag'])).toBeNull()
  })

  it('PSDまたはXDTSが不足している場合はエラーにする', () => {
    expect(() => resolveQuickExportFilePair([
      String.raw`C:\work\cut001\cut001.psd`,
    ])).toThrow('PSDとXDTSを1つずつ同時に')
  })

  it('複数ペアはエラーにする', () => {
    expect(() => resolveQuickExportFilePair([
      String.raw`C:\work\cut001\cut001.psd`,
      String.raw`C:\work\cut001\cut001.xdts`,
      String.raw`C:\work\cut002\cut002.psd`,
    ])).toThrow('PSDとXDTSを1つずつ同時に')
  })
})
