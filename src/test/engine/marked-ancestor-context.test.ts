import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCanvas as createNapiCanvas } from '@napi-rs/canvas'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { extractAllEntries } from '../../engine/cell-extractor'
import { makeLayer, makeFolder, makePassThroughFolder, makePsd } from '../helpers/psd-factory'
import type { ProjectSettings, XdtsData } from '../../types'

const DEFAULT_SETTINGS: ProjectSettings = {
  processTable: [],
  cellNamingMode: 'sequence',
  archivePatterns: [],
}

type OrigCreate = typeof document.createElement
let origCreateElement: OrigCreate | null = null

function patchDocumentCreateElement(): void {
  if (origCreateElement !== null) return
  origCreateElement = document.createElement.bind(document)
  document.createElement = ((tagName: string, options?: unknown) => {
    if (tagName.toLowerCase() === 'canvas') {
      return createNapiCanvas(1, 1) as unknown as HTMLCanvasElement
    }
    return (origCreateElement as OrigCreate)(tagName as 'div', options as never)
  }) as typeof document.createElement
}

function restoreDocumentCreateElement(): void {
  if (origCreateElement === null) return
  document.createElement = origCreateElement
  origCreateElement = null
}

function makeSolidCanvas(width: number, height: number, fillStyle: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = fillStyle
  ctx.fillRect(0, 0, width, height)
  return canvas
}

function rgbaAt(canvas: HTMLCanvasElement, x: number, y: number): [number, number, number, number] {
  const data = canvas.getContext('2d')!.getImageData(x, y, 1, 1).data
  return [data[0], data[1], data[2], data[3]]
}

function buildMarkedAncestorTree(children: Parameters<typeof makePassThroughFolder>[1]) {
  const frame = makeLayer({
    name: 'Frame',
    canvas: makeSolidCanvas(4, 4, 'rgba(255, 0, 0, 1)'),
    width: 4,
    height: 4,
  })
  const genzu = makePassThroughFolder('_原図', children)
  const tree = buildLayerTree(makePsd({ width: 4, height: 4, children: [genzu, frame] }))
  const xdts: XdtsData = {
    tracks: [{ name: '_BG1', trackNo: 0, cellNames: ['1'], frames: [] }],
    version: 5,
    header: { cut: '1', scene: '1' },
    timeTableName: 'タイムライン1',
    duration: 24,
    fps: 24,
  }
  detectAnimationFoldersByXdts(tree, xdts)
  return tree
}

describe('extractAllEntries marked ancestor context regression', () => {
  beforeAll(() => { patchDocumentCreateElement() })
  afterAll(() => { restoreDocumentCreateElement() })

  it('autoMarked 親配下の XDTS アニメフォルダも祖先コンテキストを継承する', () => {
    const tree = buildMarkedAncestorTree([
      makePassThroughFolder('_BG1', [
        makeFolder('1', []),
      ]),
    ])

    const result = extractAllEntries(tree, DEFAULT_SETTINGS, 4, 4, 'white', false)
    expect(result).toHaveLength(2)

    const bg1 = result.find(entry => entry.flatName === '_BG1_0001.jpg')
    expect(bg1).toBeDefined()
    expect(rgbaAt(bg1!.canvas, 0, 0)).toEqual([255, 0, 0, 255])
  })

  it('excludeAutoMarked=true でも autoMarked 親配下の XDTS アニメフォルダは祖先コンテキストを継承する', () => {
    const tree = buildMarkedAncestorTree([
      makePassThroughFolder('_BG1', [
        makeFolder('1', []),
      ]),
    ])

    const result = extractAllEntries(tree, DEFAULT_SETTINGS, 4, 4, 'white', true)
    expect(result).toHaveLength(1)
    expect(result[0].flatName).toBe('_BG1_0001.jpg')
    expect(rgbaAt(result[0].canvas, 0, 0)).toEqual([255, 0, 0, 255])
  })

  it('autoMarked 親配下の工程別出力も祖先コンテキストを継承する', () => {
    const tree = buildMarkedAncestorTree([
      makePassThroughFolder('_BG1', [
        makeFolder('1', [
          makeFolder('EN', []),
        ]),
      ]),
    ])

    const settings: ProjectSettings = {
      processTable: [{ suffix: '_en', folderNames: ['EN'] }],
      cellNamingMode: 'sequence',
      archivePatterns: [],
    }
    const result = extractAllEntries(tree, settings, 4, 4, 'white', false)
    expect(result.map(entry => entry.flatName).sort()).toEqual(['_BG1_0001_en.jpg', '_原図.jpg'])

    const enEntry = result.find(entry => entry.flatName === '_BG1_0001_en.jpg')
    expect(enEntry).toBeDefined()
    expect(rgbaAt(enEntry!.canvas, 0, 0)).toEqual([255, 0, 0, 255])
  })
})
