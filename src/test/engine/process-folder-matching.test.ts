import { describe, expect, it } from 'vitest'
import { extractAllEntries, extractCells } from '../../engine/cell-extractor'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { DEFAULT_PROJECT_SETTINGS, type XdtsData } from '../../types'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'

const NAME_VARIANTS = [
  { folderName: '作監 ', dictionaryName: '作監' },
  { folderName: '作監\u3000', dictionaryName: '作監' },
  { folderName: '\t作監 \u3000\t', dictionaryName: '\u3000作監 \t' },
  { folderName: ' _S\t', dictionaryName: '_s\u3000' },
]

function makeXdts(trackCount: number): XdtsData {
  return {
    version: 5,
    header: { cut: '1', scene: '1' },
    timeTableName: 'タイムライン1',
    duration: 24,
    fps: 24,
    tracks: Array.from({ length: trackCount }, (_, trackNo) => ({
      trackNo,
      name: 'A',
      cellNames: ['1'],
      frames: [{ frameIndex: 0, cellName: '1' }],
    })),
  }
}

describe('工程フォルダの空白を含む辞書照合', () => {
  it.each(NAME_VARIANTS)('別トラックの工程を本体と区別する: $folderName / $dictionaryName', ({ folderName, dictionaryName }) => {
    const tree = buildLayerTree(makePsd({
      children: [makeFolder('LO', [
        makeFolder('作画', [makeAnimationFolder('A', [makeLayer({ name: '1' })])]),
        makeFolder(folderName, [makeAnimationFolder('A', [makeLayer({ name: '1' })])]),
      ])],
    }))
    const xdts = makeXdts(2)
    detectAnimationFoldersByXdts(tree, xdts)
    const settings = {
      ...DEFAULT_PROJECT_SETTINGS,
      processTable: [{ suffix: '_s', folderNames: [dictionaryName] }],
    }

    const entries = extractAllEntries(tree, settings, 100, 100, 'white', false, 'after-cell', xdts)

    expect(entries.map(entry => entry.flatName).sort()).toEqual(['A1.jpg', 'A1_s.jpg'])
    expect(entries.map(entry => entry.path).sort()).toEqual(['A/A1.jpg', 'A/A1_s.jpg'])
    expect(entries.find(entry => entry.flatName === 'A1_s.jpg')?.processSuffixes).toEqual(['_s'])
    expect(tree[0].children[0].originalName).toBe(folderName)
    expect(settings.processTable[0].folderNames).toEqual([dictionaryName])
  })

  it.each(NAME_VARIANTS)('セル内の工程を本体から分離する: $folderName / $dictionaryName', ({ folderName, dictionaryName }) => {
    const tree = buildLayerTree(makePsd({
      children: [makeAnimationFolder('A', [makeFolder('1', [
        makeLayer({ name: '本体' }),
        makeFolder(folderName, [makeLayer({ name: '修正' })]),
      ])])],
    }))
    detectAnimationFoldersByXdts(tree, makeXdts(1))
    const settings = {
      ...DEFAULT_PROJECT_SETTINGS,
      processTable: [{ suffix: '_s', folderNames: [dictionaryName] }],
    }

    const entries = extractCells(tree[0], settings, 100, 100, [])
    const processFolder = tree[0].children[0].children[0]

    expect(entries.map(entry => entry.flatName)).toEqual(['A1.jpg', 'A1_s.jpg'])
    expect(entries[0].processSuffixes).toBeUndefined()
    expect(entries[1].processSuffixes).toEqual(['_s'])
    expect(entries[1].sourceLayerId).toBe(processFolder.id)
    expect(processFolder.originalName).toBe(folderName)
  })

  it.each(['作 監', '作\u3000監'])('名前の途中の空白は区別する: %s', folderName => {
    const tree = buildLayerTree(makePsd({
      children: [makeAnimationFolder('A', [
        makeFolder('1', [makeFolder(folderName, [makeLayer()])]),
      ])],
    }))
    detectAnimationFoldersByXdts(tree, makeXdts(1))

    const entries = extractCells(tree[0], DEFAULT_PROJECT_SETTINGS, 100, 100, [])

    expect(entries.map(entry => entry.flatName)).toEqual(['A1.jpg'])
    expect(entries[0].processSuffixes).toBeUndefined()
  })

  it('空白だけの辞書名は空白だけのフォルダに一致しない', () => {
    const tree = buildLayerTree(makePsd({
      children: [makeFolder('\u3000', [makeAnimationFolder('A', [
        makeFolder('1', [makeFolder(' ', [makeLayer()])]),
      ])])],
    }))
    detectAnimationFoldersByXdts(tree, makeXdts(1))
    const settings = {
      ...DEFAULT_PROJECT_SETTINGS,
      processTable: [{ suffix: '_s', folderNames: ['', ' ', '\u3000'] }],
    }

    const entries = extractAllEntries(tree, settings, 100, 100)

    expect(entries.map(entry => entry.flatName)).toEqual(['A1.jpg'])
    expect(entries[0].processSuffixes).toBeUndefined()
  })

  it('辞書照合の正規化は出力サフィックスに適用しない', () => {
    const tree = buildLayerTree(makePsd({
      children: [makeFolder('作監 ', [makeAnimationFolder('A', [makeLayer({ name: '1' })])])],
    }))
    detectAnimationFoldersByXdts(tree, makeXdts(1))
    const settings = {
      ...DEFAULT_PROJECT_SETTINGS,
      processTable: [{ suffix: ' _S ', folderNames: ['作監'] }],
    }

    const entries = extractAllEntries(tree, settings, 100, 100)

    expect(entries[0].flatName).toBe('A1 _S .jpg')
    expect(entries[0].processSuffixes).toEqual([' _S '])
  })
})
