/**
 * 調査用 repro: _[フォルダ名] 配下のアニメフォルダ認識バグ
 *
 * 現行 anim-folder-assignment.ts の prio1/prio2 ロジックが
 * autoMarked (_ プレフィックス) を「アーカイブ fallback」と扱っているため、
 * clean 枝と _[フォルダ名] 配下に同名フォルダが並ぶとき、
 * _[フォルダ名] 配下のフォルダは prio2 に落ちて割当を奪われる。
 *
 * これは一時ファイルで、修正実装後に適切な regression test へ昇格するか削除する。
 */
import { describe, it, expect } from 'vitest'
import { assignTracksToFolders } from '../../engine/anim-folder-assignment'
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
  it('単体ケース: _原図/_BG/BG1 のみ → 現行でも認識される (prio2 が fallback で取得)', () => {
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

  it('競合ケース: 別枝に同名 BG1 があると _原図/_BG/BG1 は prio2 で負けて認識されない', () => {
    // 通常枝の BG1 (prio1) と _原図/_BG/BG1 (prio2) の競合
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
    // ── 現行の (バグった) 挙動 ──
    // clean 枝の BG1 (prio1) がトラック 0 を取る
    // _原図/_BG/BG1 (prio2) は割当されず通常フォルダのまま
    expect(topLevelCleanBg1.isAnimationFolder).toBe(true)
    expect(markedBranchBg1.isAnimationFolder).toBe(false)  // ← ユーザーはここを true にしたい

    // 抽出結果: BG1 セルは clean 枝からしか出ない
    const entries = extractAllEntries(
      tree, DEFAULT_PROJECT_SETTINGS, 100, 100, 'transparent', false, xdts,
    )
    const bg1Cells = entries.filter(e => e.flatName.startsWith('BG1_'))
    expect(bg1Cells).toHaveLength(1)
    // path には clean 枝相当しか出ない
  })
})
