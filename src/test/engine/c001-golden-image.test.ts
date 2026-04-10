/**
 * c001 ゴールデンテスト (画像ピクセル比較)
 *
 * testdata/c001.psd + testdata/c001.xdts を実データとして読み込み、
 * extractAllEntries + extractVirtualSetEntries で生成された全 OutputEntry を PNG として
 * レンダリングし、testdata/golden/*.png と RGBA ピクセルで突き合わせる。
 *
 * path identity の c001-golden.test.ts と補完関係(こちらは実ピクセル比較)。
 *
 * jsdom + vitest-canvas-mock は実ピクセルを保持しないため、beforeAll で
 * document.createElement('canvas') を @napi-rs/canvas の Canvas 生成にすり替えて、
 * ag-psd と compositor のキャンバス操作を Skia バックエンドで走らせる。
 *
 * 比較ポリシー:
 * - ファイル名集合・ファイル数は完全一致を要求する。
 * - 画素は最大 1 階調 (alpha/RGB) の差まで許容する。CSP 手動書き出しと合成エンジンの
 *   アンチエイリアス端丸め誤差を吸収するため。1 階調を超える差はゴールデン退行として fail。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createCanvas as napiCreateCanvas, loadImage } from '@napi-rs/canvas'
import { readPsdFile } from '../../utils/psd-io'
import { parseXdts } from '../../utils/xdts-parser'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { extractAllEntries, extractVirtualSetEntries } from '../../engine/cell-extractor'
import { selectLayerTreeWithVisibility } from '../../store/selectors'
import { DEFAULT_PROJECT_SETTINGS } from '../../types'
import { buildC001VirtualSets } from '../../sample/c001-virtual-set'

const REPO_ROOT = path.resolve(__dirname, '../../..')
const TESTDATA = path.join(REPO_ROOT, 'testdata')
const GOLDEN_DIR = path.join(TESTDATA, 'golden')

/** 許容する最大チャンネル差分 (0〜255)。CSP 書き出しと合成エンジンの丸め誤差吸収用 */
const MAX_CHANNEL_TOLERANCE = 1

// ── document.createElement('canvas') を @napi-rs/canvas にすり替え ──
// ag-psd はレイヤー画像を document.createElement('canvas') で作る前提なので、
// それを本物の Skia バックエンドに差し替える。jsdom HTMLCanvasElement は
// vitest-canvas-mock によってモック化されており実ピクセルを保持しないため、
// この差し替えが無いと合成結果が全部空になる。
type OrigCreate = typeof document.createElement
let origCreateElement: OrigCreate | null = null

function patchDocumentCreateElement(): void {
  if (origCreateElement !== null) return
  origCreateElement = document.createElement.bind(document)
  document.createElement = ((tagName: string, options?: unknown) => {
    if (typeof tagName === 'string' && tagName.toLowerCase() === 'canvas') {
      return napiCreateCanvas(1, 1) as unknown as HTMLCanvasElement
    }
    return (origCreateElement as OrigCreate)(tagName as 'div', options as never)
  }) as typeof document.createElement
}

function restoreDocumentCreateElement(): void {
  if (origCreateElement === null) return
  document.createElement = origCreateElement
  origCreateElement = null
}

describe('c001 golden (image pixel match)', () => {
  beforeAll(() => { patchDocumentCreateElement() })
  afterAll(() => { restoreDocumentCreateElement() })

  it('rendered PNG set and pixels match golden (with 1-ch tolerance)', async () => {
    // 実データ読み込み
    const psdBuf = fs.readFileSync(path.join(TESTDATA, 'c001.psd'))
    const xdtsText = fs.readFileSync(path.join(TESTDATA, 'c001.xdts'), 'utf-8')

    const psd = readPsdFile(
      psdBuf.buffer.slice(psdBuf.byteOffset, psdBuf.byteOffset + psdBuf.byteLength),
    )
    const xdts = parseXdts(xdtsText)

    // ツリー構築 + XDTS 検出
    const baseTree = buildLayerTree(psd, xdts, DEFAULT_PROJECT_SETTINGS.archivePatterns)
    detectAnimationFoldersByXdts(baseTree, xdts)

    const virtualSets = buildC001VirtualSets(baseTree)

    // store の selector と同じ変換で singleMark/manualAnim を tree に反映
    const resolvedTree = selectLayerTreeWithVisibility({
      layerTree: baseTree,
      visibilityOverrides: new Map(),
      manualAnimFolderIds: new Set(),
      singleMarks: new Map(),
    } as never)

    // 出力エントリ生成 (golden は透過背景で作られているため background='transparent')
    const entries = extractAllEntries(
      resolvedTree,
      DEFAULT_PROJECT_SETTINGS,
      psd.width,
      psd.height,
      'transparent',
      false,
    )
    const vsEntries = extractVirtualSetEntries(
      resolvedTree,
      virtualSets,
      psd.width,
      psd.height,
      'transparent',
    )
    const all = [...entries, ...vsEntries]
    // 各 entry の canvas を PNG バッファへ
    const rendered = new Map<string, Buffer>()
    for (const e of all) {
      const pngName = e.flatName.replace(/\.jpg$/i, '.png')
      const c = e.canvas as unknown as {
        toBuffer: (mime: 'image/png') => Buffer
      }
      rendered.set(pngName, c.toBuffer('image/png'))
    }

    // golden 読み込み
    const goldenFiles = fs.readdirSync(GOLDEN_DIR).filter(f => f.endsWith('.png'))
    const golden = new Map<string, Buffer>()
    for (const name of goldenFiles) {
      golden.set(name, fs.readFileSync(path.join(GOLDEN_DIR, name)))
    }

    // ── ファイル名集合の完全一致 ──
    const renderedNames = [...rendered.keys()].sort()
    const goldenNames = [...golden.keys()].sort()
    expect(renderedNames).toEqual(goldenNames)

    // ── ファイル数の完全一致 ──
    expect(rendered.size).toBe(golden.size)

    // ── 画素比較 (1 階調まで許容) ──
    // 不一致時は差分イメージを .tmp にダンプして原因調査を可能にする
    const DUMP_DIR = path.join(REPO_ROOT, '.tmp', 'c001-golden-image-diff')
    const mismatches: string[] = []
    for (const [name, gBuf] of golden) {
      const rBuf = rendered.get(name)!
      if (Buffer.compare(gBuf, rBuf) === 0) continue  // binary identical → trivially pass

      const [gImg, rImg] = await Promise.all([loadImage(gBuf), loadImage(rBuf)])
      if (rImg.width !== gImg.width || rImg.height !== gImg.height) {
        fs.mkdirSync(DUMP_DIR, { recursive: true })
        fs.writeFileSync(path.join(DUMP_DIR, `golden_${name}`), gBuf)
        fs.writeFileSync(path.join(DUMP_DIR, `actual_${name}`), rBuf)
        mismatches.push(
          `${name}: size mismatch golden=${gImg.width}x${gImg.height} actual=${rImg.width}x${rImg.height}`,
        )
        continue
      }

      const gCanvas = napiCreateCanvas(gImg.width, gImg.height)
      const rCanvas = napiCreateCanvas(rImg.width, rImg.height)
      gCanvas.getContext('2d').drawImage(gImg, 0, 0)
      rCanvas.getContext('2d').drawImage(rImg, 0, 0)
      const gData = gCanvas.getContext('2d').getImageData(0, 0, gImg.width, gImg.height).data
      const rData = rCanvas.getContext('2d').getImageData(0, 0, rImg.width, rImg.height).data

      let overTolerance = 0
      let maxDiff = 0
      for (let i = 0; i < gData.length; i++) {
        const d = Math.abs(gData[i] - rData[i])
        if (d > maxDiff) maxDiff = d
        if (d > MAX_CHANNEL_TOLERANCE) overTolerance++
      }
      if (overTolerance > 0) {
        fs.mkdirSync(DUMP_DIR, { recursive: true })
        fs.writeFileSync(path.join(DUMP_DIR, `golden_${name}`), gBuf)
        fs.writeFileSync(path.join(DUMP_DIR, `actual_${name}`), rBuf)
        mismatches.push(
          `${name}: ${overTolerance} channels differ by > ${MAX_CHANNEL_TOLERANCE} ` +
          `(maxChannelDiff=${maxDiff})`,
        )
      }
    }

    if (mismatches.length > 0) {
      console.log('=== MISMATCHES ===')
      for (const m of mismatches) console.log('  ' + m)
      console.log(`Diff dump: ${DUMP_DIR}`)
    }
    expect(mismatches).toEqual([])
  }, 60_000)
})
