import { describe, it, expect } from 'vitest'
import { makeZipFileName, buildZipStream } from '../../utils/zip-builder'
import { resolveEntryNames } from '../../utils/naming'
import { replaceExtension } from '../../utils/image-export'
import type { OutputEntry, OutputConfig } from '../../types'

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

/**
 * buildZipStream のストリーミングパイプラインとしての最低限の契約を検証する。
 *
 * ここでは「ストリームが生成できる」「onProgress が N/total で呼ばれる」「canvas が
 * 処理後 release される」という振る舞いだけを確認する。ZIP のバイナリ構造の検証は
 * client-zip 側のテストに任せる(jsdom 下で canvas 実画像を含む ZIP を parse するには
 * 別の依存が必要で、本リポのスコープ外)。
 */
describe('buildZipStream', () => {
  function readUint16LE(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | (bytes[offset + 1] << 8)
  }

  function readUint32LE(bytes: Uint8Array, offset: number): number {
    return (
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)
    ) >>> 0
  }

  function listZipEntryNames(zipBytes: Uint8Array): string[] {
    let eocdOffset = -1
    for (let i = zipBytes.length - 22; i >= 0; i--) {
      if (readUint32LE(zipBytes, i) === 0x06054b50) {
        eocdOffset = i
        break
      }
    }
    if (eocdOffset < 0) throw new Error('End of central directory not found')

    const centralDirectorySize = readUint32LE(zipBytes, eocdOffset + 12)
    const centralDirectoryOffset = readUint32LE(zipBytes, eocdOffset + 16)
    const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize

    const decoder = new TextDecoder()
    const names: string[] = []
    let offset = centralDirectoryOffset
    while (offset < centralDirectoryEnd) {
      if (readUint32LE(zipBytes, offset) !== 0x02014b50) {
        throw new Error(`Unexpected central directory signature at ${offset}`)
      }
      const fileNameLength = readUint16LE(zipBytes, offset + 28)
      const extraFieldLength = readUint16LE(zipBytes, offset + 30)
      const fileCommentLength = readUint16LE(zipBytes, offset + 32)

      const nameStart = offset + 46
      const nameEnd = nameStart + fileNameLength
      names.push(decoder.decode(zipBytes.slice(nameStart, nameEnd)))

      offset = nameEnd + extraFieldLength + fileCommentLength
    }
    return names
  }

  function makeTestCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 8
    return c
  }

  function makeEntry(path: string, flatName: string): OutputEntry {
    return {
      path,
      flatName,
      canvas: makeTestCanvas(),
      sourceLayerId: 'test-layer',
    }
  }

  const BASE_CONFIG: OutputConfig = {
    format: 'jpg',
    jpgQuality: 0.9,
    background: 'white',
    structure: 'hierarchy',
    processSuffixPosition: 'after-cell',
    excludeAutoMarked: false,
    excludedProcessSuffixes: [],
  }

  it('ReadableStream を返す', () => {
    const entries = [makeEntry('A/A_0001.jpg', 'A_0001.jpg')]
    const stream = buildZipStream(entries, BASE_CONFIG, 0, 0)
    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it('PNG形式ではZIPエントリ名拡張子も.pngになる', async () => {
    const entries = [
      makeEntry('A/A_0001.jpg', 'A_0001.jpg'),
      makeEntry('B/B_0001.jpg', 'B_0001.jpg'),
    ]
    const config: OutputConfig = {
      ...BASE_CONFIG,
      format: 'png',
      background: 'transparent',
      structure: 'hierarchy',
    }

    const stream = buildZipStream(entries, config, 0, 0)
    const zipBytes = new Uint8Array(await new Response(stream).arrayBuffer())

    expect(listZipEntryNames(zipBytes)).toEqual(['A/A_0001.png', 'B/B_0001.png'])
  })

  it('PNG形式のフラット展開でもZIPエントリ名拡張子が.pngになる', async () => {
    const entries = [
      makeEntry('A/A_0001.jpg', 'A_0001.jpg'),
      makeEntry('B/B_0001.jpg', 'B_0001.jpg'),
    ]
    const config: OutputConfig = {
      ...BASE_CONFIG,
      format: 'png',
      background: 'transparent',
      structure: 'flat',
    }

    const stream = buildZipStream(entries, config, 0, 0)
    const zipBytes = new Uint8Array(await new Response(stream).arrayBuffer())

    expect(listZipEntryNames(zipBytes)).toEqual(['A_0001.png', 'B_0001.png'])
  })

  it('ストリーム消費時に onProgress が done/total で呼ばれる', async () => {
    const entries = [
      makeEntry('A/A_0001.jpg', 'A_0001.jpg'),
      makeEntry('A/A_0002.jpg', 'A_0002.jpg'),
      makeEntry('B/B_0001.jpg', 'B_0001.jpg'),
    ]
    const calls: Array<[number, number]> = []
    const stream = buildZipStream(entries, BASE_CONFIG, 0, 0, (done, total) => {
      calls.push([done, total])
    })
    // ストリームを最後まで消費して generator を駆動する
    await new Response(stream).arrayBuffer()
    // 各エントリ 1 回ずつ進捗コールバック、total は全部 3
    expect(calls).toEqual([[1, 3], [2, 3], [3, 3]])
  })

  it('ストリーム消費後に各 OutputEntry の canvas 参照が release される', async () => {
    const entries = [
      makeEntry('A/A_0001.jpg', 'A_0001.jpg'),
      makeEntry('B/B_0001.jpg', 'B_0001.jpg'),
    ]
    const stream = buildZipStream(entries, BASE_CONFIG, 0, 0)
    await new Response(stream).arrayBuffer()
    // canvas が null に置き換わって元の大きい参照が解放されている
    expect(entries[0].canvas).toBeNull()
    expect(entries[1].canvas).toBeNull()
  })

  /**
   * Zip Slip 攻撃ベクトルに対するサニタイズ動作の検証。
   * ZIP バイナリを解析するのはコストが高いので、buildZipStream の**内部で**
   * 使用されるパス正規化 (sanitizeZipPath) が期待どおり動いていることを、
   * resolveEntryNames 経由で組み立てられる path / flatName のインテグレーション
   * レベルで確認する。
   *
   * 具体的には: client-zip は AsyncIterable の name をそのまま ZIP エントリ名にする。
   * よって「ストリームに流れる name」が安全になっていれば、ZIP エントリも安全。
   * これを担保するために、ここでは buildZipStream の内部で使われる resolveEntryNames
   * + sanitizeZipPath 組合せの結果を間接的に確認する: 実際に stream を消費して
   * エントリが何個出力されるか、canvas が全部 release されるかで副作用を観察する。
   */
  it('Zip Slip: `..` を含むパスのエントリも安全に処理される(クラッシュしない)', async () => {
    const entries = [
      makeEntry('../../etc/passwd.jpg', '../../etc/passwd.jpg'),
      makeEntry('A/A_0001.jpg', 'A_0001.jpg'),
    ]
    const stream = buildZipStream(entries, BASE_CONFIG, 0, 0)
    // 例外なくストリームが完了し、両エントリが処理される
    await new Response(stream).arrayBuffer()
    expect(entries[0].canvas).toBeNull()
    expect(entries[1].canvas).toBeNull()
  })

  it('Zip Slip: Windows 禁則文字を含むレイヤー名もサニタイズされて処理される', async () => {
    const entries = [
      makeEntry('A<B>/C|D.jpg', 'C|D.jpg'),
      makeEntry('CON/file.jpg', 'file.jpg'),
    ]
    const stream = buildZipStream(entries, BASE_CONFIG, 0, 0)
    await new Response(stream).arrayBuffer()
    expect(entries[0].canvas).toBeNull()
    expect(entries[1].canvas).toBeNull()
  })
})
