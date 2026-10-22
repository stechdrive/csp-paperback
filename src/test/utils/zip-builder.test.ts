import { describe, it, expect } from 'vitest'
import { unzipSync } from 'fflate'
import { makeZipFileName, buildZipStream } from '../../utils/zip-builder'
import { DEFAULT_OUTPUT_CONFIG, type OutputEntry, type OutputConfig } from '../../types'

describe('makeZipFileName', () => {
  it('入力ファイル名の拡張子を.zipに置換し、拡張子なしにも対応する', () => {
    expect(makeZipFileName('cut001.psd')).toBe('cut001.zip')
    expect(makeZipFileName('my_cut.clip')).toBe('my_cut.zip')
    expect(makeZipFileName('cut001')).toBe('cut001.zip')
  })
})

// Canvas encoding is mocked in this suite. Verify the actual ZIP entries and
// streaming lifecycle here; e2e/export-golden.spec.ts checks decoded PNG pixels.
describe('buildZipStream', () => {
  function makeEntry(path: string, flatName: string): OutputEntry {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 8
    return { path, flatName, canvas, sourceLayerId: 'test-layer' }
  }

  const baseConfig: OutputConfig = { ...DEFAULT_OUTPUT_CONFIG, revisionBorderEnabled: false }

  async function namesIn(stream: ReadableStream<Uint8Array>): Promise<string[]> {
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
    return Object.keys(unzipSync(bytes)).sort()
  }

  for (const format of ['jpg', 'png'] as const) {
    for (const structure of ['hierarchy', 'flat'] as const) {
      it(`${format}/${structure}: 実ZIPの名前・枚数・拡張子を保つ`, async () => {
        const entries = [makeEntry('A/A_0001.jpg', 'A_0001.jpg'), makeEntry('B/B_0001.jpg', 'B_0001.jpg')]
        const stream = buildZipStream(entries, { ...baseConfig, format, structure })
        expect(await namesIn(stream)).toEqual(structure === 'hierarchy'
          ? [`A/A_0001.${format}`, `B/B_0001.${format}`]
          : [`A_0001.${format}`, `B_0001.${format}`])
      })
    }
  }

  it('拡張子変換と禁則文字の置換で衝突しても、実ZIPに全ファイルを残す', async () => {
    const entries = [makeEntry('A/cell?.jpg', 'cell?.jpg'), makeEntry('B/cell*.png', 'cell*.png')]
    expect(await namesIn(buildZipStream(entries, { ...baseConfig, format: 'png', structure: 'flat' })))
      .toEqual(['cell_.png', 'cell__2.png'])
  })

  it.each(['hierarchy', 'flat'] as const)('%s: ZIP内に上位・絶対パス、禁則文字、予約名を残さない', async structure => {
    const paths = ['../../etc/passwd.jpg', '/root/file.jpg', 'A<B>/C|D.jpg', 'CON/file.jpg', 'C:\\temp\\evil.jpg']
    const entries = paths.map(path => makeEntry(path, path))
    expect(await namesIn(buildZipStream(entries, { ...baseConfig, format: 'jpg', structure })))
      .toEqual(['A_B_/C_D.jpg', 'C__temp_evil.jpg', '_/_/etc/passwd.jpg', '_CON/file.jpg', 'root/file.jpg'].sort())
  })

  it('ストリーム消費時に各エントリの進捗を一度ずつ通知する', async () => {
    const entries = [makeEntry('A/1.jpg', '1.jpg'), makeEntry('A/2.jpg', '2.jpg'), makeEntry('B/3.jpg', '3.jpg')]
    const calls: Array<[number, number]> = []
    const stream = buildZipStream(entries, baseConfig, 0, 0, (done, total) => { calls.push([done, total]) })
    await namesIn(stream)
    expect(calls).toEqual([[1, 3], [2, 3], [3, 3]])
  })

  it('読み出す前はcanvasを保持し、消費後は全エントリの参照を解放する', async () => {
    const entries = [makeEntry('A/1.jpg', '1.jpg'), makeEntry('B/2.jpg', '2.jpg')]
    const canvases = entries.map(entry => entry.canvas)
    const stream = buildZipStream(entries, baseConfig)
    expect(entries.map(entry => entry.canvas)).toEqual(canvases)
    await namesIn(stream)
    expect(entries.map(entry => entry.canvas)).toEqual([null, null])
  })
})
