/**
 * c001 ゴールデンテスト
 *
 * testdata/c001.psd + testdata/c001.xdts を実データとして読み込み、
 * 出力エントリの flatName が testdata/golden/*.png のファイル名セットと一致することを検証する。
 *
 * 画像比較はしない(canvas 合成の実行結果までは jsdom で再現困難)。
 * 代わりに「どのパスが出力されるか」という path identity レベルでの整合性を保証する。
 *
 * 不足だけでなく余分な出力・重複名も失敗にする。画像の保証は
 * c001-golden-image.test.ts とブラウザの書き出し画像比較が担当する。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { readPsdFile } from '../../utils/psd-io'
import { parseXdts } from '../../utils/xdts-parser'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { extractAllEntries } from '../../engine/cell-extractor'
import { DEFAULT_PROJECT_SETTINGS } from '../../types'

const GOLDEN_PROJECT_SETTINGS = {
  ...DEFAULT_PROJECT_SETTINGS,
  cellNamingMode: 'sheet-sequence' as const,
  sequenceDigitMode: 'fixed-4' as const,
  cellPrefixSeparator: 'underscore' as const,
  animationSequenceSeparator: 'underscore' as const,
}
import { C001_VIRTUAL_SET_JPG } from '../../sample/c001-virtual-set'

const REPO_ROOT = path.resolve(__dirname, '../../..')
const TESTDATA = path.join(REPO_ROOT, 'testdata')
const GOLDEN_DIR = path.join(TESTDATA, 'golden')

describe('c001 golden (path identity)', () => {
  it('extractAllEntries の flatName が golden PNG ファイル名セットと一致する', () => {
    // 実データを fs で読み込む(Node 環境でのみ動く)
    const psdBuf = fs.readFileSync(path.join(TESTDATA, 'c001.psd'))
    const xdtsText = fs.readFileSync(path.join(TESTDATA, 'c001.xdts'), 'utf-8')

    // parse
    const psd = readPsdFile(psdBuf.buffer.slice(psdBuf.byteOffset, psdBuf.byteOffset + psdBuf.byteLength))
    const xdts = parseXdts(xdtsText)

    // ツリー構築
    const tree = buildLayerTree(psd, xdts, DEFAULT_PROJECT_SETTINGS.archivePatterns, DEFAULT_PROJECT_SETTINGS.autoMarkFolderNames)

    // XDTS 検出(新ロジックで assignTracksToFolders + 割当された layer のみ anim folder 化)
    const assignResult = detectAnimationFoldersByXdts(tree, xdts)

    // 3-track XDTS を使っているので全トラック割当されているはず
    expect(assignResult.unmatchedTracks).toHaveLength(0)

    // 出力エントリ生成
    const entries = extractAllEntries(
      tree, GOLDEN_PROJECT_SETTINGS, psd.width, psd.height, 'white', false,
    )

    // golden ファイル名 (.png → .jpg に変換)
    const goldenFiles = fs.readdirSync(GOLDEN_DIR).filter(f => f.endsWith('.png'))
    const expectedFlatNames = goldenFiles
        .map(f => f.replace(/\.png$/, '.jpg'))
        // 仮想セットは c001-golden-image.test.ts でピクセル比較する。
        .filter(name => name !== C001_VIRTUAL_SET_JPG)
        .sort()

    expect(entries.map(entry => entry.flatName).sort()).toEqual(expectedFlatNames)
    expect(new Set(entries.map(entry => entry.path)).size).toBe(entries.length)
  })
})
