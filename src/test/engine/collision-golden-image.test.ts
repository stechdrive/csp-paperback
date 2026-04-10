/**
 * collision fixture golden test
 *
 * testdata/collision は、同名トラック・_配下アニメフォルダ・手動アニメフォルダ・
 * 構造コンテナ不透明度の衝突条件を狙って生成した人工PSD/XDTS。
 * 各入力レイヤーには単体レイヤーまでのパス文字列が描き込まれており、
 * golden PNG は manifest の期待ラベル一覧から直接生成している。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createCanvas as napiCreateCanvas, loadImage } from '@napi-rs/canvas'
import { readPsdFile } from '../../utils/psd-io'
import { parseXdts } from '../../utils/xdts-parser'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { extractAllEntries } from '../../engine/cell-extractor'
import { selectLayerTreeWithVisibility } from '../../store/selectors'
import { DEFAULT_PROJECT_SETTINGS, type CspLayer } from '../../types'

const REPO_ROOT = path.resolve(__dirname, '../../..')
const FIXTURE_DIR = path.join(REPO_ROOT, 'testdata', 'collision')
const MAX_CHANNEL_TOLERANCE = 1

interface CollisionCase {
  manualAnimFolderPaths: string[][]
  entries: Record<string, unknown>
}

interface CollisionManifest {
  cases: Record<string, CollisionCase>
}

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

function findLayerByPath(layers: CspLayer[], segments: string[]): CspLayer | null {
  let currentLayers = layers
  let current: CspLayer | null = null

  for (const segment of segments) {
    current = currentLayers.find(layer => layer.originalName === segment) ?? null
    if (!current) return null
    currentLayers = current.children
  }

  return current
}

function renderEntries(
  tree: CspLayer[],
  testCase: CollisionCase,
  docWidth: number,
  docHeight: number,
): Map<string, Buffer> {
  const manualAnimFolderIds = new Set<string>()
  for (const manualPath of testCase.manualAnimFolderPaths) {
    const layer = findLayerByPath(tree, manualPath)
    expect(layer, `manual anim folder path not found: ${manualPath.join('/')}`).not.toBeNull()
    manualAnimFolderIds.add(layer!.id)
  }

  const resolvedTree = selectLayerTreeWithVisibility({
    layerTree: tree,
    visibilityOverrides: new Map(),
    manualAnimFolderIds,
    singleMarks: new Map(),
  } as never)

  const entries = extractAllEntries(
    resolvedTree,
    DEFAULT_PROJECT_SETTINGS,
    docWidth,
    docHeight,
    'transparent',
    false,
  )

  const rendered = new Map<string, Buffer>()
  for (const entry of entries) {
    const pngName = entry.flatName.replace(/\.jpg$/i, '.png')
    const canvas = entry.canvas as unknown as {
      toBuffer: (mime: 'image/png') => Buffer
    }
    rendered.set(pngName, canvas.toBuffer('image/png'))
  }
  return rendered
}

async function expectRenderedToMatchGolden(
  rendered: Map<string, Buffer>,
  goldenDir: string,
): Promise<void> {
  const goldenFiles = fs.readdirSync(goldenDir).filter(file => file.endsWith('.png')).sort()
  const renderedNames = [...rendered.keys()].sort()

  expect(renderedNames).toEqual(goldenFiles)

  const mismatches: string[] = []
  const dumpDir = path.join(REPO_ROOT, '.tmp', 'collision-golden-image-diff')

  for (const goldenName of goldenFiles) {
    const goldenBuf = fs.readFileSync(path.join(goldenDir, goldenName))
    const renderedBuf = rendered.get(goldenName)!
    if (Buffer.compare(goldenBuf, renderedBuf) === 0) continue

    const [goldenImage, renderedImage] = await Promise.all([
      loadImage(goldenBuf),
      loadImage(renderedBuf),
    ])

    if (goldenImage.width !== renderedImage.width || goldenImage.height !== renderedImage.height) {
      fs.mkdirSync(dumpDir, { recursive: true })
      fs.writeFileSync(path.join(dumpDir, `golden_${goldenName}`), goldenBuf)
      fs.writeFileSync(path.join(dumpDir, `actual_${goldenName}`), renderedBuf)
      mismatches.push(
        `${goldenName}: size mismatch golden=${goldenImage.width}x${goldenImage.height} ` +
        `actual=${renderedImage.width}x${renderedImage.height}`,
      )
      continue
    }

    const goldenCanvas = napiCreateCanvas(goldenImage.width, goldenImage.height)
    const renderedCanvas = napiCreateCanvas(renderedImage.width, renderedImage.height)
    goldenCanvas.getContext('2d').drawImage(goldenImage, 0, 0)
    renderedCanvas.getContext('2d').drawImage(renderedImage, 0, 0)

    const goldenData = goldenCanvas.getContext('2d').getImageData(0, 0, goldenImage.width, goldenImage.height).data
    const renderedData = renderedCanvas.getContext('2d').getImageData(0, 0, renderedImage.width, renderedImage.height).data

    let overTolerance = 0
    let maxDiff = 0
    for (let i = 0; i < goldenData.length; i++) {
      const diff = Math.abs(goldenData[i] - renderedData[i])
      if (diff > maxDiff) maxDiff = diff
      if (diff > MAX_CHANNEL_TOLERANCE) overTolerance++
    }

    if (overTolerance > 0) {
      fs.mkdirSync(dumpDir, { recursive: true })
      fs.writeFileSync(path.join(dumpDir, `golden_${goldenName}`), goldenBuf)
      fs.writeFileSync(path.join(dumpDir, `actual_${goldenName}`), renderedBuf)
      mismatches.push(
        `${goldenName}: ${overTolerance} channels differ by > ${MAX_CHANNEL_TOLERANCE} ` +
        `(maxChannelDiff=${maxDiff})`,
      )
    }
  }

  if (mismatches.length > 0) {
    console.log('=== COLLISION GOLDEN MISMATCHES ===')
    for (const mismatch of mismatches) console.log(`  ${mismatch}`)
    console.log(`Diff dump: ${dumpDir}`)
  }
  expect(mismatches).toEqual([])
}

describe('collision golden (image pixel match)', () => {
  beforeAll(() => { patchDocumentCreateElement() })
  afterAll(() => { restoreDocumentCreateElement() })

  it.each(['xdts-only', 'manual-book'])('%s rendered PNGs match golden', async caseName => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(FIXTURE_DIR, 'manifest.json'), 'utf-8')
    ) as CollisionManifest
    const testCase = manifest.cases[caseName]
    expect(testCase, `missing collision case: ${caseName}`).toBeDefined()

    const psdBuf = fs.readFileSync(path.join(FIXTURE_DIR, 'collision.psd'))
    const xdtsText = fs.readFileSync(path.join(FIXTURE_DIR, 'collision.xdts'), 'utf-8')
    const psd = readPsdFile(
      psdBuf.buffer.slice(psdBuf.byteOffset, psdBuf.byteOffset + psdBuf.byteLength),
    )
    const xdts = parseXdts(xdtsText)

    const tree = buildLayerTree(psd, xdts, DEFAULT_PROJECT_SETTINGS.archivePatterns)
    const assignResult = detectAnimationFoldersByXdts(tree, xdts)
    expect(assignResult.unmatchedTracks).toHaveLength(0)

    const rendered = renderEntries(tree, testCase, psd.width, psd.height)
    await expectRenderedToMatchGolden(
      rendered,
      path.join(FIXTURE_DIR, `golden-${caseName}`),
    )
  }, 60_000)
})
