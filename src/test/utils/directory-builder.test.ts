import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OutputConfig, OutputEntry } from '../../types'
import { saveEntriesToDirectory, supportsDirectoryExport } from '../../utils/directory-builder'

interface MemoryDirectoryState {
  name: string
  directories: Map<string, MemoryDirectoryState>
  files: Map<string, Blob>
}

const BASE_CONFIG: OutputConfig = {
  format: 'jpg',
  jpgQuality: 0.9,
  background: 'white',
  structure: 'hierarchy',
  processSuffixPosition: 'after-cell',
  excludedProcessSuffixes: [],
  excludeAutoMarked: false,
}

const originalShowDirectoryPicker = Object.getOwnPropertyDescriptor(window, 'showDirectoryPicker')

function createDirectoryState(name: string): MemoryDirectoryState {
  return { name, directories: new Map(), files: new Map() }
}

function installDirectoryPicker(factory: () => Promise<FileSystemDirectoryHandle>) {
  Object.defineProperty(window, 'showDirectoryPicker', {
    configurable: true,
    writable: true,
    value: vi.fn(factory),
  })
}

function restoreDirectoryPicker() {
  if (originalShowDirectoryPicker) {
    Object.defineProperty(window, 'showDirectoryPicker', originalShowDirectoryPicker)
  } else {
    delete (window as { showDirectoryPicker?: unknown }).showDirectoryPicker
  }
}

function createDirectoryHandle(state: MemoryDirectoryState): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name: state.name,
    async getDirectoryHandle(name: string, options?: { create?: boolean }) {
      if (state.files.has(name)) {
        throw new DOMException('A file with the same name exists', 'TypeMismatchError')
      }

      const existing = state.directories.get(name)
      if (existing) return createDirectoryHandle(existing)
      if (!options?.create) throw new DOMException('Directory not found', 'NotFoundError')

      const child = createDirectoryState(name)
      state.directories.set(name, child)
      return createDirectoryHandle(child)
    },
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (state.directories.has(name)) {
        throw new DOMException('A directory with the same name exists', 'TypeMismatchError')
      }

      const existing = state.files.get(name)
      if (!existing && !options?.create) {
        throw new DOMException('File not found', 'NotFoundError')
      }
      if (!existing && options?.create) {
        state.files.set(name, new Blob())
      }

      return {
        kind: 'file',
        name,
        async createWritable() {
          return {
            async write(input: Blob | BufferSource | string) {
              state.files.set(name, input instanceof Blob ? input : new Blob([input]))
            },
            async close() {
              return
            },
          } as unknown as FileSystemWritableFileStream
        },
      } as unknown as FileSystemFileHandle
    },
  } as unknown as FileSystemDirectoryHandle
}

function makeTestCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 8
  return canvas
}

function makeEntry(path: string, flatName: string): OutputEntry {
  return {
    path,
    flatName,
    canvas: makeTestCanvas(),
    sourceLayerId: flatName,
  }
}

afterEach(() => {
  restoreDirectoryPicker()
})

describe('supportsDirectoryExport', () => {
  it('showDirectoryPicker がない環境では false を返す', () => {
    restoreDirectoryPicker()
    delete (window as { showDirectoryPicker?: unknown }).showDirectoryPicker
    expect(supportsDirectoryExport()).toBe(false)
  })

  it('showDirectoryPicker がある環境では true を返す', () => {
    installDirectoryPicker(async () => createDirectoryHandle(createDirectoryState('exports')))
    expect(supportsDirectoryExport()).toBe(true)
  })
})

describe('saveEntriesToDirectory', () => {
  it('階層保持モードでは新規の出力ルートフォルダ配下にサブフォルダを書き出す', async () => {
    const parent = createDirectoryState('exports')
    parent.directories.set('cut001', createDirectoryState('cut001'))
    installDirectoryPicker(async () => createDirectoryHandle(parent))

    const entries = [
      makeEntry('A/A_0001.jpg', 'A_0001.jpg'),
      makeEntry('B/B_0001.jpg', 'B_0001.jpg'),
    ]
    const progressCalls: Array<[number, number]> = []

    const folderName = await saveEntriesToDirectory(
      entries,
      { ...BASE_CONFIG, format: 'png', background: 'transparent', structure: 'hierarchy' },
      'cut001.psd',
      0,
      0,
      (done, total) => progressCalls.push([done, total]),
    )

    expect(folderName).toBe('cut001_2')
    const exportRoot = parent.directories.get('cut001_2')
    expect(exportRoot?.directories.get('A')?.files.has('A_0001.png')).toBe(true)
    expect(exportRoot?.directories.get('B')?.files.has('B_0001.png')).toBe(true)
    expect(progressCalls).toEqual([[1, 2], [2, 2]])
    expect(entries[0].canvas).toBeNull()
    expect(entries[1].canvas).toBeNull()
  })

  it('フラット展開モードでは出力ルート直下にファイルを書き出す', async () => {
    const parent = createDirectoryState('exports')
    installDirectoryPicker(async () => createDirectoryHandle(parent))

    await saveEntriesToDirectory(
      [makeEntry('A/A_0001.jpg', 'A_0001.jpg')],
      { ...BASE_CONFIG, format: 'png', background: 'transparent', structure: 'flat' },
      'cut002.psd',
    )

    const exportRoot = parent.directories.get('cut002')
    expect(exportRoot?.files.has('A_0001.png')).toBe(true)
  })

  it('ユーザキャンセルは AbortError をそのまま伝播する', async () => {
    installDirectoryPicker(async () => {
      throw new DOMException('User cancelled', 'AbortError')
    })

    await expect(
      saveEntriesToDirectory(
        [makeEntry('A/A_0001.jpg', 'A_0001.jpg')],
        BASE_CONFIG,
        'cut003.psd',
      ),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
