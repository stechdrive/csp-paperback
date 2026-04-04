import { describe, it, expect } from 'vitest'
import { makeZipFileName } from '../../utils/zip-builder'
import { resolveEntryNames } from '../../utils/naming'
import { replaceExtension } from '../../utils/image-export'

describe('makeZipFileName', () => {
  it('PSDファイル名から.zipファイル名を生成する', () => {
    expect(makeZipFileName('cut001.psd')).toBe('cut001.zip')
    expect(makeZipFileName('my_cut.psd')).toBe('my_cut.zip')
  })

  it('拡張子なしのファイル名にも対応する', () => {
    expect(makeZipFileName('cut001')).toBe('cut001.zip')
  })
})

describe('ZIP出力パス生成（ロジック単体テスト）', () => {
  it('階層保持モードではpathをZIPパスとして使う', () => {
    const entries = [
      { path: 'A/A0001.jpg', flatName: 'A0001.jpg' },
      { path: 'A/A0002.jpg', flatName: 'A0002.jpg' },
    ]
    const zipPaths = entries.map(e => e.path)
    expect(zipPaths).toEqual(['A/A0001.jpg', 'A/A0002.jpg'])
  })

  it('フラット展開モードではflatNameをZIPパスとして使う', () => {
    const entries = [
      { path: 'A/A0001.jpg', flatName: 'A0001.jpg' },
      { path: 'B/B0001.jpg', flatName: 'B0001.jpg' },
    ]
    const zipPaths = entries.map(e => e.flatName)
    expect(zipPaths).toEqual(['A0001.jpg', 'B0001.jpg'])
  })

  it('フォーマット変更後に衝突解決を適用する', () => {
    const entries = [
      { path: 'A/cell.jpg', flatName: 'cell.jpg' },
      { path: 'B/cell.jpg', flatName: 'cell.jpg' },
    ]
    const normalized = entries.map(e => ({
      ...e,
      path: replaceExtension(e.path, 'png'),
      flatName: replaceExtension(e.flatName, 'png'),
    }))
    const resolved = resolveEntryNames(normalized)
    expect(resolved[0].flatName).toBe('cell.png')
    expect(resolved[1].flatName).toBe('cell_2.png')
  })
})
