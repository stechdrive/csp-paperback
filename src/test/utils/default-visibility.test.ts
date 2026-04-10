import { describe, it, expect } from 'vitest'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { addXdtsUnusedCellHiddenOverrides, buildDefaultVisibilityOverrides } from '../../utils/default-visibility'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import type { XdtsData } from '../../types'

function makeXdts(cellNames: string[]): XdtsData {
  return {
    tracks: [{
      name: 'A',
      trackNo: 0,
      cellNames,
      frames: cellNames.map((cellName, frameIndex) => ({ frameIndex, cellName })),
    }],
    version: 5,
    header: { cut: '1', scene: '1' },
    timeTableName: 'timeline',
    duration: 24,
    fps: 24,
  }
}

describe('default visibility overrides', () => {
  it('XDTSで使われていないアニメセルを初期非表示にする', () => {
    const animA = makeFolder('A', [
      makeLayer({ name: '1' }),
      makeLayer({ name: '2' }),
      makeLayer({ name: '3' }),
    ])
    const tree = buildLayerTree(makePsd({ children: [animA] }))
    const xdts = makeXdts(['1'])
    detectAnimationFoldersByXdts(tree, xdts)

    const animFolder = tree[0]
    const [cell3, cell2, cell1] = animFolder.children
    const overrides = buildDefaultVisibilityOverrides(tree, xdts)

    expect(overrides.get(cell1.id)).toBeUndefined()
    expect(overrides.get(cell2.id)).toBe(true)
    expect(overrides.get(cell3.id)).toBe(true)
  })

  it('同名セルはCSPに合わせてボトム側だけをXDTS使用セルとして扱う', () => {
    const animA = makeFolder('A', [
      makeLayer({ name: '1' }),
      makeLayer({ name: '1' }),
    ])
    const tree = buildLayerTree(makePsd({ children: [animA] }))
    const xdts = makeXdts(['1'])
    detectAnimationFoldersByXdts(tree, xdts)

    const animFolder = tree[0]
    const [topCell, bottomCell] = animFolder.children
    const overrides = buildDefaultVisibilityOverrides(tree, xdts)

    expect(overrides.get(bottomCell.id)).toBeUndefined()
    expect(overrides.get(topCell.id)).toBe(true)
  })

  it('XDTS後読み時はユーザーが既に触った目玉状態を上書きしない', () => {
    const animA = makeFolder('A', [
      makeLayer({ name: '1' }),
      makeLayer({ name: '2' }),
    ])
    const tree = buildLayerTree(makePsd({ children: [animA] }))
    const xdts = makeXdts(['1'])
    detectAnimationFoldersByXdts(tree, xdts)

    const unusedCell = tree[0].children[0]
    const overrides = new Map([[unusedCell.id, false]])
    addXdtsUnusedCellHiddenOverrides(tree, xdts, overrides, false)

    expect(overrides.get(unusedCell.id)).toBe(false)
  })
})
