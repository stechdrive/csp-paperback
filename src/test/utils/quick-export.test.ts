import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/clip-io', () => ({ readClipFile: vi.fn() }))

vi.mock('../../store', () => ({
  useAppStore: { getState: vi.fn() },
}))

vi.mock('../../platform/files', () => ({
  allowTauriLaunchFilePaths: vi.fn(),
  loadableFilesFromPaths: vi.fn(),
}))

vi.mock('../../utils/export-entries', () => ({
  planExportEntriesFromState: vi.fn(),
}))

vi.mock('../../utils/directory-builder', () => ({
  saveEntriesToDirectoryPath: vi.fn(),
}))

vi.mock('@tauri-apps/api/path', () => ({
  dirname: vi.fn(),
}))

import { dirname } from '@tauri-apps/api/path'
import { useAppStore } from '../../store'
import { allowTauriLaunchFilePaths, loadableFilesFromPaths } from '../../platform/files'
import { planExportEntriesFromState } from '../../utils/export-entries'
import { saveEntriesToDirectoryPath } from '../../utils/directory-builder'
import { resolveQuickExportFilePair, runQuickExport } from '../../utils/quick-export'
import { readClipFile } from '../../utils/clip-io'
import { DEFAULT_OUTPUT_CONFIG } from '../../types'
import type { ExportEntry } from '../../types/output'

const mockedGetState = vi.mocked(useAppStore.getState)
const mockedAllowLaunchPaths = vi.mocked(allowTauriLaunchFilePaths)
const mockedLoadableFilesFromPaths = vi.mocked(loadableFilesFromPaths)
const mockedBuildOutputEntries = vi.mocked(planExportEntriesFromState)
const mockedSaveEntries = vi.mocked(saveEntriesToDirectoryPath)
const mockedDirname = vi.mocked(dirname)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolveQuickExportFilePair', () => {
  it('CLIP単独とCLIP＋PSDを解決し、XDTSを要求しない', () => {
    expect(resolveQuickExportFilePair(['cut.clip'])).toEqual({ clipPath: 'cut.clip' })
    expect(resolveQuickExportFilePair(['cut.psd', 'cut.clip', 'cut.xdts'])).toEqual({ clipPath: 'cut.clip', psdPath: 'cut.psd' })
    expect(() => resolveQuickExportFilePair(['one.clip', 'two.clip'])).toThrow('1ファイルずつ')
  })
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

describe('runQuickExport', () => {
  it('CLIP単独を共通ローダーで読み、CLIPと同じ場所へ書き出す', async () => {
    const source = { width: 8, height: 8, dpi: 72, layers: [], timelines: [], defaultTimelineId: null, diagnostics: [] }
    const state = { loadClip: vi.fn(), clipFileName: 'cut.clip', docWidth: 8, docDpiX: 72, docDpiY: 72, savedOutputConfig: DEFAULT_OUTPUT_CONFIG, clipDiagnostics: [] }
    vi.mocked(readClipFile).mockResolvedValue(source)
    mockedGetState.mockReturnValue(state as never)
    mockedDirname.mockResolvedValue('C:/cut')
    mockedLoadableFilesFromPaths.mockResolvedValue([{ name: 'cut.clip', sourceDirectory: 'C:/cut', arrayBuffer: async () => new ArrayBuffer(0), text: async () => '' }])
    mockedBuildOutputEntries.mockReturnValue([{} as ExportEntry])
    mockedSaveEntries.mockResolvedValue('C:/cut/cut')
    await expect(runQuickExport(['C:/cut/cut.clip'], vi.fn())).resolves.toEqual({ outputDirectory: 'C:/cut/cut', entryCount: 1, warnings: [] })
    expect(readClipFile).toHaveBeenCalledWith(expect.any(ArrayBuffer), true)
    expect(state.loadClip).toHaveBeenCalledWith(source, 'cut.clip', 'C:/cut', undefined)
    expect(mockedSaveEntries).toHaveBeenCalledWith(expect.any(Array), DEFAULT_OUTPUT_CONFIG, 'cut.clip', 'C:/cut', 72, 72, expect.any(Function))
  })
  it('保存済み設定でPSD/XDTSを読み込み、同じ設定を合成と保存へ渡す', async () => {
    const resetProject = vi.fn()
    const loadXdts = vi.fn()
    const loadPsd = vi.fn()
    const savedOutputConfig = {
      ...DEFAULT_OUTPUT_CONFIG,
      format: 'png' as const,
      background: 'transparent' as const,
      structure: 'hierarchy' as const,
      revisionBorderEnabled: false,
    }
    const state = {
      resetProject,
      loadXdts,
      loadPsd,
      psdFileName: 'cut001.psd',
      docWidth: 1920,
      docDpiX: 144,
      docDpiY: 144,
      timelineData: { tracks: [] },
      outputConfig: { ...DEFAULT_OUTPUT_CONFIG },
      savedOutputConfig,
      clipDiagnostics: [],
    }
    const entry: ExportEntry = {
      path: 'A/A1.png',
      flatName: 'A1.png',
      createCanvas: () => document.createElement('canvas'),
      sourceLayerId: 'cell-1',
    }
    const xdtsFile = {
      name: 'cut001.xdts',
      sourceDirectory: String.raw`C:\work\cut001`,
      text: vi.fn().mockResolvedValue('xdts'),
      arrayBuffer: vi.fn(),
    }
    const psdFile = {
      name: 'cut001.psd',
      sourceDirectory: String.raw`C:\work\cut001`,
      text: vi.fn(),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
    }
    mockedGetState.mockReturnValue(state as never)
    mockedDirname.mockResolvedValue(String.raw`C:\work\cut001`)
    mockedLoadableFilesFromPaths.mockResolvedValue([xdtsFile, psdFile] as never)
    mockedBuildOutputEntries.mockReturnValue([entry])
    mockedSaveEntries.mockResolvedValue(String.raw`C:\work\cut001\cut001`)
    const progress: Array<{ progress: number; message: string }> = []

    const result = await runQuickExport([
      String.raw`C:\work\cut001\cut001.psd`,
      String.raw`C:\work\cut001\cut001.xdts`,
    ], value => progress.push(value))

    expect(mockedAllowLaunchPaths).toHaveBeenCalledOnce()
    expect(resetProject).toHaveBeenCalledOnce()
    expect(loadXdts).toHaveBeenCalledWith('xdts', 'cut001.xdts', String.raw`C:\work\cut001`)
    expect(loadPsd).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'cut001.psd', String.raw`C:\work\cut001`)
    expect(mockedBuildOutputEntries).toHaveBeenCalledWith(state, savedOutputConfig)
    expect(mockedSaveEntries).toHaveBeenCalledWith(
      [entry],
      savedOutputConfig,
      'cut001.psd',
      String.raw`C:\work\cut001`,
      144,
      144,
      expect.any(Function),
    )
    expect(progress.at(-1)).toEqual({ progress: 1, message: '完了しました' })
    expect(result).toEqual({
      outputDirectory: String.raw`C:\work\cut001\cut001`,
      entryCount: 1,
      warnings: [],
    })
  })

  it('合成結果が空なら保存処理へ進まない', async () => {
    const state = {
      resetProject: vi.fn(),
      loadXdts: vi.fn(),
      loadPsd: vi.fn(),
      psdFileName: 'cut001.psd',
      docWidth: 1920,
      timelineData: { tracks: [] },
      savedOutputConfig: { ...DEFAULT_OUTPUT_CONFIG },
    }
    mockedGetState.mockReturnValue(state as never)
    mockedDirname.mockResolvedValue(String.raw`C:\work`)
    mockedLoadableFilesFromPaths.mockResolvedValue([
      { name: 'cut001.xdts', text: vi.fn().mockResolvedValue('xdts'), arrayBuffer: vi.fn() },
      { name: 'cut001.psd', text: vi.fn(), arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)) },
    ] as never)
    mockedBuildOutputEntries.mockReturnValue([])

    await expect(runQuickExport([
      String.raw`C:\work\cut001.psd`,
      String.raw`C:\work\cut001.xdts`,
    ], vi.fn())).rejects.toThrow('出力対象がありません')
    expect(mockedSaveEntries).not.toHaveBeenCalled()
  })
})
