import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_OUTPUT_CONFIG, type OutputEntry } from '../../types'

vi.mock('../../store', () => ({
  useAppStore: { getState: vi.fn() },
}))

vi.mock('../../utils/export-entries', () => ({
  buildOutputEntriesFromState: vi.fn(),
}))

vi.mock('../../utils/zip-builder', () => ({
  buildZipStream: vi.fn(),
  saveZipStream: vi.fn(),
  makeZipFileName: vi.fn((name: string) => name.replace(/\.psd$/i, '.zip')),
}))

vi.mock('../../utils/directory-builder', () => ({
  saveEntriesToDirectory: vi.fn(),
  supportsDirectoryExport: vi.fn(),
}))

import { useAppStore } from '../../store'
import { useExport } from '../../hooks/useExport'
import { buildOutputEntriesFromState } from '../../utils/export-entries'
import { buildZipStream, saveZipStream } from '../../utils/zip-builder'
import { saveEntriesToDirectory, supportsDirectoryExport } from '../../utils/directory-builder'

const mockedGetState = vi.mocked(useAppStore.getState)
const mockedBuildEntries = vi.mocked(buildOutputEntriesFromState)
const mockedBuildZipStream = vi.mocked(buildZipStream)
const mockedSaveZipStream = vi.mocked(saveZipStream)
const mockedSaveDirectory = vi.mocked(saveEntriesToDirectory)
const mockedSupportsDirectory = vi.mocked(supportsDirectoryExport)

function makeEntry(): OutputEntry {
  return {
    path: 'A/A1.png',
    flatName: 'A1.png',
    canvas: document.createElement('canvas'),
    sourceLayerId: 'cell-1',
  }
}

function makeLoadedState() {
  return {
    docWidth: 1920,
    docDpiX: 144,
    docDpiY: 144,
    psdFileName: 'cut001.psd',
    psdSourceDirectory: String.raw`C:\work\cut001`,
    xdtsSourceDirectory: String.raw`C:\work\cut001`,
    outputConfig: {
      ...DEFAULT_OUTPUT_CONFIG,
      format: 'png' as const,
      background: 'transparent' as const,
      structure: 'hierarchy' as const,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedSupportsDirectory.mockReturnValue(true)
})

afterEach(cleanup)

describe('useExport', () => {
  it('現在の設定でエントリを組み立て、ZIPへ保存する', async () => {
    const state = makeLoadedState()
    const entries = [makeEntry()]
    const stream = new ReadableStream<Uint8Array>()
    mockedGetState.mockReturnValue(state as never)
    mockedBuildEntries.mockReturnValue(entries)
    mockedBuildZipStream.mockReturnValue(stream)
    mockedSaveZipStream.mockResolvedValue()
    const { result } = renderHook(() => useExport())

    await act(async () => {
      await result.current.startExport('zip')
    })

    expect(mockedBuildEntries).toHaveBeenCalledWith(state)
    expect(mockedBuildZipStream).toHaveBeenCalledWith(
      entries,
      state.outputConfig,
      144,
      144,
      expect.any(Function),
    )
    expect(mockedSaveZipStream).toHaveBeenCalledWith(
      stream,
      'cut001.zip',
      String.raw`C:\work\cut001`,
    )
    expect(result.current).toMatchObject({ isExporting: false, progress: 1, error: null })
  })

  it('フォルダ出力では同じエントリと現在設定をディレクトリ保存へ渡す', async () => {
    const state = makeLoadedState()
    const entries = [makeEntry()]
    mockedGetState.mockReturnValue(state as never)
    mockedBuildEntries.mockReturnValue(entries)
    mockedSaveDirectory.mockResolvedValue('cut001')
    const { result } = renderHook(() => useExport())

    await act(async () => {
      await result.current.startExport('directory')
    })

    expect(mockedSaveDirectory).toHaveBeenCalledWith(
      entries,
      state.outputConfig,
      'cut001.psd',
      144,
      144,
      expect.any(Function),
      String.raw`C:\work\cut001`,
    )
    expect(mockedSaveZipStream).not.toHaveBeenCalled()
    expect(result.current.progress).toBe(1)
  })

  it('PSD未読込なら書き出し処理へ進まずエラーを返す', async () => {
    mockedGetState.mockReturnValue({
      ...makeLoadedState(),
      psdFileName: null,
      docWidth: 0,
    } as never)
    const { result } = renderHook(() => useExport())

    await act(async () => {
      await result.current.startExport('zip')
    })

    expect(result.current.error).toBe('PSD ファイルが読み込まれていません')
    expect(mockedBuildEntries).not.toHaveBeenCalled()
  })

  it('保存ダイアログのキャンセルはエラー表示せず終了する', async () => {
    const state = makeLoadedState()
    mockedGetState.mockReturnValue(state as never)
    mockedBuildEntries.mockReturnValue([makeEntry()])
    mockedBuildZipStream.mockReturnValue(new ReadableStream<Uint8Array>())
    mockedSaveZipStream.mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    const { result } = renderHook(() => useExport())

    await act(async () => {
      await result.current.startExport('zip')
    })

    expect(result.current.isExporting).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
