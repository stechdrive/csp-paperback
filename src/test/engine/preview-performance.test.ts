import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvas as createNapiCanvas } from '@napi-rs/canvas'
import * as flatten from '../../engine/flatten'
import { NavigatorPreviewCache } from '../../engine/navigator-preview-cache'
import { extractCells } from '../../engine/cell-extractor'
import { buildLayerTree } from '../../engine/tree-builder'
import { DEFAULT_PROJECT_SETTINGS, type OutputEntry } from '../../types'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'

beforeEach(() => {
  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => (
    tagName.toLowerCase() === 'canvas'
      ? createNapiCanvas(8, 8) as unknown as HTMLCanvasElement
      : originalCreateElement(tagName, options)
  ))
})

afterEach(() => vi.restoreAllMocks())

function coloredLayer(name: string, color: string) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(1, 1, 6, 6)
  return makeLayer({ name, canvas, width: 8, height: 8 })
}

function animationTree() {
  const tree = buildLayerTree(makePsd({
    width: 8,
    height: 8,
    children: [makeAnimationFolder('A', [
      coloredLayer('same', '#f00'), coloredLayer('same', '#00f'), coloredLayer('other', '#0f0'),
    ])],
  }))
  tree[0].isAnimationFolder = true
  tree[0].animationFolder = { detectedBy: 'manual', trackName: 'A' }
  return tree
}

function snapshot(entries: OutputEntry[]) {
  return entries.map(({ canvas, ...entry }) => ({
    ...entry,
    pixels: [...canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data],
  }))
}

describe('navigator preview cache', () => {
  it('shares both navigator views and revisited cels without recompositing', () => {
    const tree = animationTree()
    const render = vi.spyOn(flatten, 'flattenToCanvas')
    const cache = new NavigatorPreviewCache()
    const selected = new Map([[tree[0].id, 0]])
    const first = cache.get(tree, 8, 8, selected)
    expect(cache.get(tree, 8, 8, new Map(selected))).toBe(first)
    const second = cache.get(tree, 8, 8, new Map([[tree[0].id, 1]]))
    expect(second).not.toBe(first)
    expect([...second.getContext('2d')!.getImageData(2, 2, 1, 1).data])
      .not.toEqual([...first.getContext('2d')!.getImageData(2, 2, 1, 1).data])
    expect(cache.get(tree, 8, 8, selected)).toBe(first)
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('invalidates after layer edits and dimension changes', () => {
    const tree = animationTree()
    const cache = new NavigatorPreviewCache()
    const selected = new Map<string, number>()
    const before = cache.get(tree, 8, 8, selected)
    const editedTree = [{ ...tree[0], opacity: 0 }]
    const edited = cache.get(editedTree, 8, 8, selected)
    expect(edited).not.toBe(before)
    expect([...edited.getContext('2d')!.getImageData(2, 2, 1, 1).data]).toEqual([255, 255, 255, 255])
    const resized = cache.get(editedTree, 16, 8, selected)
    expect(resized.width).toBe(16)
    expect(resized).not.toBe(edited)
    cache.clear()
    expect(cache.get(editedTree, 16, 8, selected)).not.toBe(resized)
  })

  it('evicts least recently used frames at the pixel budget, retaining one oversized frame', () => {
    const tree = animationTree()
    const render = vi.spyOn(flatten, 'flattenToCanvas')
    const cache = new NavigatorPreviewCache(8 * 8 * 4 * 2)
    const cells = [0, 1, 2].map(index => new Map([[tree[0].id, index]]))
    const first = cache.get(tree, 8, 8, cells[0])
    cache.get(tree, 8, 8, cells[1])
    expect(cache.get(tree, 8, 8, cells[0])).toBe(first)
    cache.get(tree, 8, 8, cells[2])
    expect(cache.get(tree, 8, 8, cells[0])).toBe(first)
    cache.get(tree, 8, 8, cells[1])
    expect(render).toHaveBeenCalledTimes(4)

    const oversizedCache = new NavigatorPreviewCache(1)
    const oversized = oversizedCache.get(tree, 8, 8, cells[0])
    expect(oversizedCache.get(tree, 8, 8, cells[0])).toBe(oversized)
    oversizedCache.get(tree, 8, 8, cells[1])
    expect(oversizedCache.get(tree, 8, 8, cells[0])).not.toBe(oversized)
  })
})

describe('selected-cell extraction', () => {
  it.each(['sequence', 'cellname', 'sheet-sequence'] as const)(
    'keeps full-export pixels, process entries, numbering and collisions in %s mode',
    cellNamingMode => {
      const tree = buildLayerTree(makePsd({
        width: 8, height: 8,
        children: [makeAnimationFolder('A', Array.from({ length: 3 }, (_, i) => makeFolder('same', [
          coloredLayer('body', ['#f00', '#00f', '#0f0'][i]),
          makeFolder('作監', [coloredLayer('drawing', '#ff008088')]),
        ])))],
      }))
      tree[0].isAnimationFolder = true
      tree[0].animationFolder = { detectedBy: 'manual', trackName: 'A' }
      const settings = { ...DEFAULT_PROJECT_SETTINGS, cellNamingMode }
      const numbers = new Map(tree[0].children.map((cell, i) => [cell.id, i + 6]))
      const all = extractCells(tree[0], settings, 8, 8, [], '', 'A', 'transparent', [], 'after-cell', 2, numbers)
      const selected = tree[0].children[1]
      const render = vi.spyOn(flatten, 'flattenTree')
      const entries = extractCells(tree[0], settings, 8, 8, [], '', 'A', 'transparent', [], 'after-cell', 2, numbers, undefined, selected.id)
      expect(snapshot(entries)).toEqual(snapshot(all.filter(entry => entry.sourceCellId === selected.id)))
      expect(entries).toHaveLength(2)
      expect(render).toHaveBeenCalledTimes(2)
      if (cellNamingMode === 'cellname') expect(entries[0].flatName).toMatch(/_2\.jpg$/)
    },
  )

  it('renders one cel rather than the whole 100-cel animation folder', () => {
    const tree = animationTree()
    tree[0].children = Array.from({ length: 100 }, (_, i) => ({ ...tree[0].children[0], id: `cel-${i}` }))
    const settings = { ...DEFAULT_PROJECT_SETTINGS, cellNamingMode: 'sequence' as const }
    const render = vi.spyOn(flatten, 'flattenTree')
    extractCells(tree[0], settings, 8, 8, [])
    expect(render).toHaveBeenCalledTimes(100)
    render.mockClear()
    const entries = extractCells(tree[0], settings, 8, 8, [], '', 'A', 'white', [], 'after-cell', undefined, undefined, undefined, 'cel-53')
    expect(entries).toHaveLength(1)
    expect(render).toHaveBeenCalledTimes(1)
    expect(entries[0].flatName).toBe('A_047.jpg')
  })
})
