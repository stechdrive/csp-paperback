import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  stat: vi.fn(async () => ({ size: 4 })),
  dirname: vi.fn(async (path: string) => {
    const slash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
    return slash >= 0 ? path.slice(0, slash) : ''
  }),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({ readFile: mocks.readFile, stat: mocks.stat }))

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
}))

vi.mock('@tauri-apps/api/path', () => ({
  dirname: mocks.dirname,
}))

describe('loadableFilesFromPaths', () => {
  it('rejects oversized native input before reading bytes', async () => {
    const { loadableFilesFromPaths } = await import('../../platform/files')
    const [file] = await loadableFilesFromPaths(['C:/work/huge.psd'])
    mocks.stat.mockResolvedValueOnce({ size: 1024 ** 3 + 1 })
    mocks.readFile.mockClear()
    await expect(file.arrayBuffer()).rejects.toThrow('1 GiB')
    expect(mocks.readFile).not.toHaveBeenCalled()
  })

  it('reuses complete buffers while isolating partial views', async () => {
    const { loadableFilesFromPaths } = await import('../../platform/files')
    const [file] = await loadableFilesFromPaths(['C:/work/test.psd'])
    const bytes = new Uint8Array([1, 2, 3, 4])
    mocks.readFile.mockResolvedValueOnce(bytes).mockResolvedValueOnce(bytes.subarray(1, 3))
    expect(await file.arrayBuffer()).toBe(bytes.buffer)
    expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([2, 3])
  })

  it('Tauri のドロップパスからファイル名と sourceDirectory を作る', async () => {
    const { loadableFilesFromPaths } = await import('../../platform/files')
    const files = await loadableFilesFromPaths([
      String.raw`C:\work\cut001\cut001.psd`,
      String.raw`C:\work\cut001\cut001.xdts`,
    ])

    expect(files.map(file => ({
      name: file.name,
      sourceDirectory: file.sourceDirectory,
    }))).toEqual([
      { name: 'cut001.psd', sourceDirectory: String.raw`C:\work\cut001` },
      { name: 'cut001.xdts', sourceDirectory: String.raw`C:\work\cut001` },
    ])
    expect(mocks.dirname).toHaveBeenCalledWith(String.raw`C:\work\cut001\cut001.psd`)
    expect(mocks.dirname).toHaveBeenCalledWith(String.raw`C:\work\cut001\cut001.xdts`)
  })
})
