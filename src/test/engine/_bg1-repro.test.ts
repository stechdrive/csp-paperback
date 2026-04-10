/**
 * regression: _[フォルダ名] 配下のアニメフォルダ認識
 *
 * `_` プレフィックスは単体出力マークであり、XDTS アニメフォルダ候補を
 * fallback 扱いする条件ではない。
 */
import { describe, it, expect } from 'vitest'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { extractAllEntries } from '../../engine/cell-extractor'
import { makeLayer, makeFolder, makePsd } from '../helpers/psd-factory'
import { DEFAULT_PROJECT_SETTINGS } from '../../types/project'
import type { XdtsData, CspLayer } from '../../types'

function findAll(tree: CspLayer[], name: string): CspLayer[] {
  const result: CspLayer[] = []
  const walk = (ls: CspLayer[]) => {
    for (const l of ls) {
      if (l.originalName === name) result.push(l)
      walk(l.children)
    }
  }
  walk(tree)
  return result
}

describe('_[フォルダ名] 配下アニメフォルダ認識 repro', () => {
  it('単体ケース: _原図/_BG/BG1 のみ → 認識される', () => {
    const bg1 = makeFolder('BG1', [makeFolder('1', [makeLayer({ name: '線画' })])])
    const _BG = makeFolder('_BG', [bg1])
    const _genzu = makeFolder('_原図', [_BG])
    const psd = makePsd({ children: [_genzu] })

    const tree = buildLayerTree(psd, undefined, [])
    const xdts: XdtsData = {
      tracks: [{ name: 'BG1', trackNo: 0, cellNames: ['1'], frames: [] }],
      version: 5, header: { cut: '1', scene: '1' },
      timeTableName: 'T1', duration: 24, fps: 24,
    }
    detectAnimationFoldersByXdts(tree, xdts)

    const bg1s = findAll(tree, 'BG1')
    expect(bg1s).toHaveLength(1)
    expect(bg1s[0].isAnimationFolder).toBe(true)  // 単体なら認識される
  })

  it('競合ケース: 別枝に同名 BG1 があってもボトム順で _原図/_BG/BG1 が認識される', () => {
    // 通常枝の BG1 と _原図/_BG/BG1 の競合
    const cleanBg1 = makeFolder('BG1', [makeFolder('1', [makeLayer({ name: '線画' })])])
    const markedBg1 = makeFolder('BG1', [makeFolder('1', [makeLayer({ name: '線画' })])])
    const _BG = makeFolder('_BG', [markedBg1])
    const _genzu = makeFolder('_原図', [_BG])
    // ag-psd bottom-first なので先頭が下。_原図 を下、cleanBg1 を上に置く
    const psd = makePsd({ children: [_genzu, cleanBg1] })

    const tree = buildLayerTree(psd, undefined, [])
    const xdts: XdtsData = {
      tracks: [{ name: 'BG1', trackNo: 0, cellNames: ['1'], frames: [] }],
      version: 5, header: { cut: '1', scene: '1' },
      timeTableName: 'T1', duration: 24, fps: 24,
    }
    detectAnimationFoldersByXdts(tree, xdts)

    const bg1s = findAll(tree, 'BG1')
    expect(bg1s).toHaveLength(2)
    // tree[0] は top-first 順で一番上 = cleanBg1 の変換結果
    // tree[1] は _原図 → _BG → BG1
    const topLevelCleanBg1 = tree[0]
    const markedBranchBg1 = tree[1].children[0].children[0]
    expect(topLevelCleanBg1.originalName).toBe('BG1')
    expect(markedBranchBg1.originalName).toBe('BG1')
    // XDTS trackNo 0 はボトムレイヤーなので、ボトム側の _原図/_BG/BG1 が割当される
    expect(topLevelCleanBg1.isAnimationFolder).toBe(false)
    expect(markedBranchBg1.isAnimationFolder).toBe(true)

    // 抽出結果: BG1 セルは _原図/_BG/BG1 から出る
    const entries = extractAllEntries(
      tree, DEFAULT_PROJECT_SETTINGS, 100, 100, 'transparent', false,
    )
    const bg1Cells = entries.filter(e => e.flatName.startsWith('BG1_'))
    expect(bg1Cells).toHaveLength(1)
    // path には clean 枝相当しか出ない
  })
})
