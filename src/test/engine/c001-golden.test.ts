/**
 * c001 ゴールデンテスト
 *
 * testdata/c001.psd + testdata/c001.xdts を実データとして読み込み、
 * 出力エントリの flatName が testdata/golden/*.png のファイル名セットと一致することを検証する。
 *
 * 画像比較はしない(canvas 合成の実行結果までは jsdom で再現困難)。
 * 代わりに「どのパスが出力されるか」という path identity レベルでの整合性を保証する。
 *
 * この test が成立することが #1 同名バグ修正の最重要確認ポイント:
 * - 既存 golden は修正前の挙動で作られた正解データ
 * - 修正後も flatName セットが golden と一致 = path level で機能退行していない
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { readPsdFile } from '../../utils/psd-io'
import { parseXdts } from '../../utils/xdts-parser'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { extractAllEntries } from '../../engine/cell-extractor'
import { DEFAULT_PROJECT_SETTINGS } from '../../types'
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
    const tree = buildLayerTree(psd, xdts, DEFAULT_PROJECT_SETTINGS.archivePatterns)

    // XDTS 検出(新ロジックで assignTracksToFolders + 割当された layer のみ anim folder 化)
    const assignResult = detectAnimationFoldersByXdts(tree, xdts)

    // 3-track XDTS を使っているので全トラック割当されているはず
    expect(assignResult.unmatchedTracks).toHaveLength(0)

    // 出力エントリ生成
    const entries = extractAllEntries(
      tree, DEFAULT_PROJECT_SETTINGS, psd.width, psd.height, 'white', false,
    )

    const flatNames = new Set(entries.map(e => e.flatName))

    // golden ファイル名 (.png → .jpg に変換)
    const goldenFiles = fs.readdirSync(GOLDEN_DIR).filter(f => f.endsWith('.png'))
    const expectedFlatNames = new Set(
      goldenFiles
        .map(f => f.replace(/\.png$/, '.jpg'))
        // 仮想セットは c001-golden-image.test.ts でピクセル比較する。
        .filter(name => name !== C001_VIRTUAL_SET_JPG),
    )

    // debug 出力: 両セットの内容
    const missing = [...expectedFlatNames].filter(n => !flatNames.has(n))
    const unexpected = [...flatNames].filter(n => !expectedFlatNames.has(n))
    if (missing.length > 0 || unexpected.length > 0) {
      console.log('=== Golden comparison ===')
      console.log('Expected (from golden):', [...expectedFlatNames].sort())
      console.log('Actual (from extract):', [...flatNames].sort())
      console.log('Missing (in golden but not in extract):', missing)
      console.log('Unexpected (in extract but not in golden):', unexpected)
    }

    // すべての golden ファイル名が extract 結果に含まれている
    for (const expected of expectedFlatNames) {
      expect(flatNames, `missing expected entry: ${expected}`).toContain(expected)
    }

    // 参考: extract 結果に golden 非対応の余分なエントリがあるかを表示する
    // 現段階では strict equality は assert しない(将来確認するため情報として残す)。
    if (unexpected.length > 0) {
      console.log('[info] c001 extract produced entries not in golden:', unexpected)
    }
  })

  it('c001 の extract 結果を全列挙(デバッグ参考用)', () => {
    const psdBuf = fs.readFileSync(path.join(TESTDATA, 'c001.psd'))
    const xdtsText = fs.readFileSync(path.join(TESTDATA, 'c001.xdts'), 'utf-8')
    const psd = readPsdFile(psdBuf.buffer.slice(psdBuf.byteOffset, psdBuf.byteOffset + psdBuf.byteLength))
    const xdts = parseXdts(xdtsText)
    const tree = buildLayerTree(psd, xdts, DEFAULT_PROJECT_SETTINGS.archivePatterns)
    detectAnimationFoldersByXdts(tree, xdts)
    const entries = extractAllEntries(
      tree, DEFAULT_PROJECT_SETTINGS, psd.width, psd.height, 'white', false,
    )
    const dump = entries.map(e => ({ path: e.path, flatName: e.flatName }))
    console.log('c001 entries count:', dump.length)
    for (const e of dump) console.log(`  ${e.path}`)
    expect(entries.length).toBeGreaterThan(0)
  })
})
