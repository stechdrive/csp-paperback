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
  it('登録名で自動マークされた非表示フォルダを初期表示ONにする', () => {
    const sourceFolder = makeFolder('原図', [makeLayer({ name: '線画' })])
    sourceFolder.hidden = true
    const tree = buildLayerTree(
      makePsd({ children: [sourceFolder] }),
      undefined,
      [],
      ['原図'],
    )

    const overrides = buildDefaultVisibilityOverrides(tree)

    expect(tree[0].autoMarked).toBe(true)
    expect(overrides.get(tree[0].id)).toBe(false)
  })

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

  it('兼用カットではXDTS未使用セルを初期非表示にしない', () => {
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
    const overrides = buildDefaultVisibilityOverrides(tree, xdts, true)

    expect(overrides.get(cell1.id)).toBeUndefined()
    expect(overrides.get(cell2.id)).toBeUndefined()
    expect(overrides.get(cell3.id)).toBeUndefined()
  })

  it('兼用カットではXDTS検出アニメフォルダ本体だけを初期表示ONにし、子セルは触らない', () => {
    const hiddenCell = makeLayer({ name: '1', hidden: true })
    const visibleCell = makeLayer({ name: '2' })
    const animA = makeFolder('A', [hiddenCell, visibleCell])
    animA.hidden = true
    const tree = buildLayerTree(makePsd({ children: [animA] }))
    const xdts = makeXdts([])
    detectAnimationFoldersByXdts(tree, xdts)

    const animFolder = tree[0]
    const [cell2, cell1] = animFolder.children
    const overrides = buildDefaultVisibilityOverrides(tree, xdts, true)

    expect(overrides.get(animFolder.id)).toBe(false)
    expect(overrides.get(cell1.id)).toBeUndefined()
    expect(overrides.get(cell2.id)).toBeUndefined()
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
