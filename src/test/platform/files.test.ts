import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dirname: vi.fn(async (path: string) => {
    const slash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
    return slash >= 0 ? path.slice(0, slash) : ''
  }),
}))

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
}))

vi.mock('@tauri-apps/api/path', () => ({
  dirname: mocks.dirname,
}))

describe('loadableFilesFromPaths', () => {
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
