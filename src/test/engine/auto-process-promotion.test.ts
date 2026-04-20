/**
 * autoMarked フォルダの工程一致による自動アニメフォルダ昇格ロジックのテスト。
 *
 * 対象: promoteAutoMarkedByProcessMatch (src/engine/tree-builder.ts)
 *
 * ルール:
 * - 祖先がアニメフォルダなら対象外
 * - 子孫に既に昇格済みフォルダを含むなら対象外（内側優先）
 * - 直接の子のみ照合（孫は見ない）
 * - 既に isAnimationFolder=true なら対象外
 * - 名前照合は trim + lowercase
 * - processTable 空なら一切昇格しない
 */
import { describe, it, expect } from 'vitest'
import {
  buildLayerTree,
  detectAnimationFoldersByXdts,
  promoteAutoMarkedByProcessMatch,
} from '../../engine/tree-builder'
import { makeLayer, makeFolder, makePsd } from '../helpers/psd-factory'
import { DEFAULT_PROJECT_SETTINGS } from '../../types/project'
import type { CspLayer, XdtsData } from '../../types'

const DEFAULT_TABLE = DEFAULT_PROJECT_SETTINGS.processTable

function findByName(tree: CspLayer[], name: string): CspLayer[] {
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

describe('promoteAutoMarkedByProcessMatch', () => {
  it('基本: _BG1/{レイヤー, _e/} → _BG1 がアニメフォルダに昇格', () => {
    const psd = makePsd({
      children: [
        makeFolder('_BG1', [
          makeLayer({ name: 'レイヤー 1 のコピー' }),
          makeFolder('_e', [makeLayer({ name: '修正' })]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd, undefined, [])
    const promoted = promoteAutoMarkedByProcessMatch(tree, DEFAULT_TABLE)

    const bg1 = findByName(promoted, '_BG1')[0]
    expect(bg1.isAnimationFolder).toBe(true)
    expect(bg1.autoMarked).toBe(false)
    expect(bg1.animationFolder?.detectedBy).toBe('autoProcess')
    expect(bg1.animationFolder?.trackName).toBe('_BG1')
  })

  it('内側優先: _外/_内/{レイヤー, _e/} → _内のみ昇格', () => {
    const psd = makePsd({
      children: [
        makeFolder('_外', [
          makeFolder('_内', [
            makeLayer({ name: 'レイヤー' }),
            makeFolder('_e', [makeLayer({ name: '修正' })]),
          ]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd, undefined, [])
    const promoted = promoteAutoMarkedByProcessMatch(tree, DEFAULT_TABLE)

    const inner = findByName(promoted, '_内')[0]
    const outer = findByName(promoted, '_外')[0]
    expect(inner.isAnimationFolder).toBe(true)
    expect(outer.isAnimationFolder).toBe(false)
    expect(outer.autoMarked).toBe(true)
  })

  it('パターンB: _原図/{_e/, _BG1/レイヤー} → _原図が昇格（_BG1には_e子なし）', () => {
    const psd = makePsd({
      children: [
        makeFolder('_原図', [
          makeFolder('_e', [makeLayer({ name: '全体修正' })]),
          makeFolder('_BG1', [makeLayer({ name: 'レイヤー' })]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd, undefined, [])
    const promoted = promoteAutoMarkedByProcessMatch(tree, DEFAULT_TABLE)

    const genzu = findByName(promoted, '_原図')[0]
    const bg1 = findByName(promoted, '_BG1')[0]
    expect(genzu.isAnimationFolder).toBe(true)
    expect(genzu.animationFolder?.detectedBy).toBe('autoProcess')
    // _BG1 は親がアニメフォルダなので昇格対象外（祖先ガード）、かつ element 側に _e なしなので autoMarked も外れる
    expect(bg1.isAnimationFolder).toBe(false)
  })

  it('パターンC: 外側と内側両方に _e → 内側のみ昇格（外側は autoMarked 据え置き）', () => {
    const psd = makePsd({
      children: [
        makeFolder('_原図', [
          makeFolder('_e', [makeLayer({ name: '全体修正' })]),
          makeFolder('_BG1', [
            makeLayer({ name: 'レイヤー' }),
            makeFolder('_e', [makeLayer({ name: 'BG1修正' })]),
          ]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd, undefined, [])
    const promoted = promoteAutoMarkedByProcessMatch(tree, DEFAULT_TABLE)

    const bg1 = findByName(promoted, '_BG1')[0]
    const genzu = findByName(promoted, '_原図')[0]
    expect(bg1.isAnimationFolder).toBe(true)
    expect(bg1.animationFolder?.detectedBy).toBe('autoProcess')
    expect(genzu.isAnimationFolder).toBe(false)
    expect(genzu.autoMarked).toBe(true)
  })

  it('XDTS 優先: 既にアニメ化済みのフォルダは対象外（祖先ガード）', () => {
    const psd = makePsd({
      children: [
        makeFolder('A', [
          makeFolder('_e', [makeLayer({ name: '何か' })]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd, undefined, [])
    const xdts: XdtsData = {
      tracks: [{ name: 'A', trackNo: 0, cellNames: ['_e'], frames: [] }],
      version: 5, header: { cut: '1', scene: '1' },
      timeTableName: 'T1', duration: 24, fps: 24,
    }
    detectAnimationFoldersByXdts(tree, xdts)
    const promoted = promoteAutoMarkedByProcessMatch(tree, DEFAULT_TABLE)

    const a = findByName(promoted, 'A')[0]
    // XDTS 検出で A が anim folder になっているので detectedBy は xdts のまま
    expect(a.isAnimationFolder).toBe(true)
    expect(a.animationFolder?.detectedBy).toBe('xdts')
  })

  it('祖先にアニメフォルダがあれば子孫は昇格しない', () => {
    // アニメフォルダ B の配下に autoMarked な _sub/{_e} を置く
    const psd = makePsd({
      children: [
        makeFolder('B', [
          makeFolder('1', [
            // NOTE: buildLayerTree 内の autoMarked 判定は animFolderContext で
            // 抑制されるが、万一残ってしまったケースも祖先ガードで守る。
            // ここでは buildLayerTree 後に手動で autoMarked を立てて模擬する。
          ]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd, undefined, [])
    const xdts: XdtsData = {
      tracks: [{ name: 'B', trackNo: 0, cellNames: ['1'], frames: [] }],
      version: 5, header: { cut: '1', scene: '1' },
      timeTableName: 'T1', duration: 24, fps: 24,
    }
    detectAnimationFoldersByXdts(tree, xdts)

    // 模擬: アニメフォルダ B のセル 1 直下に autoMarked な _sub を後付けで挿入
    const cellOne = findByName(tree, '1')[0]
    const subFake: CspLayer = {
      ...makeAutoMarkedStub('_sub'),
      children: [makeAutoMarkedStub('_e')],
    }
    cellOne.children.push(subFake)

    const promoted = promoteAutoMarkedByProcessMatch(tree, DEFAULT_TABLE)
    const sub = findByName(promoted, '_sub')[0]
    expect(sub.isAnimationFolder).toBe(false)
    expect(sub.autoMarked).toBe(true)
  })

  it('processTable が空なら一切昇格しない', () => {
    const psd = makePsd({
      children: [
        makeFolder('_BG1', [
          makeLayer({ name: 'レイヤー' }),
          makeFolder('_e', [makeLayer({ name: '修正' })]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd, undefined, [])
    const promoted = promoteAutoMarkedByProcessMatch(tree, [])
    expect(promoted).toBe(tree)
    const bg1 = findByName(promoted, '_BG1')[0]
    expect(bg1.isAnimationFolder).toBe(false)
    expect(bg1.autoMarked).toBe(true)
  })

  it('archive パターン除外: _old_BG1 は autoMarked ではないので昇格対象外', () => {
    const psd = makePsd({
      children: [
        makeFolder('_old_BG1', [
          makeLayer({ name: 'レイヤー' }),
          makeFolder('_e', [makeLayer({ name: '修正' })]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd, undefined, ['_old'])
    const promoted = promoteAutoMarkedByProcessMatch(tree, DEFAULT_TABLE)
    const oldBg1 = findByName(promoted, '_old_BG1')[0]
    expect(oldBg1.autoMarked).toBe(false)
    expect(oldBg1.isAnimationFolder).toBe(false)
  })

  it('孫は見ない: _BG1/body/_e/ は _BG1 の直接の子に _e がないので昇格しない', () => {
    const psd = makePsd({
      children: [
        makeFolder('_BG1', [
          makeFolder('body', [
            makeFolder('_e', [makeLayer({ name: '修正' })]),
          ]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd, undefined, [])
    const promoted = promoteAutoMarkedByProcessMatch(tree, DEFAULT_TABLE)
    const bg1 = findByName(promoted, '_BG1')[0]
    expect(bg1.isAnimationFolder).toBe(false)
    expect(bg1.autoMarked).toBe(true)
  })

  it('直接の子が processTable 名フォルダでない場合は昇格しない', () => {
    const psd = makePsd({
      children: [
        makeFolder('_BG1', [
          makeLayer({ name: 'レイヤー' }),
          makeFolder('memo', [makeLayer({ name: 'メモ' })]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd, undefined, [])
    const promoted = promoteAutoMarkedByProcessMatch(tree, DEFAULT_TABLE)
    const bg1 = findByName(promoted, '_BG1')[0]
    expect(bg1.isAnimationFolder).toBe(false)
  })

  it('日本語名での照合（演出 は _e と同じサフィックス）', () => {
    const psd = makePsd({
      children: [
        makeFolder('_BG1', [
          makeLayer({ name: 'レイヤー' }),
          makeFolder('演出', [makeLayer({ name: '修正' })]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd, undefined, [])
    const promoted = promoteAutoMarkedByProcessMatch(tree, DEFAULT_TABLE)
    const bg1 = findByName(promoted, '_BG1')[0]
    expect(bg1.isAnimationFolder).toBe(true)
  })

  it('大文字小文字・前後空白は無視して照合', () => {
    const psd = makePsd({
      children: [
        makeFolder('_BG1', [
          makeLayer({ name: 'レイヤー' }),
          makeFolder('  _E  ', [makeLayer({ name: '修正' })]),
        ]),
      ],
    })
    const tree = buildLayerTree(psd, undefined, [])
    const promoted = promoteAutoMarkedByProcessMatch(tree, DEFAULT_TABLE)
    const bg1 = findByName(promoted, '_BG1')[0]
    expect(bg1.isAnimationFolder).toBe(true)
  })

  it('直接の子がレイヤーのみ（フォルダなし）なら昇格しない', () => {
    const psd = makePsd({
      children: [
        makeFolder('_BG1', [
          makeLayer({ name: '_e' }), // フォルダではなくレイヤー
        ]),
      ],
    })
    const tree = buildLayerTree(psd, undefined, [])
    const promoted = promoteAutoMarkedByProcessMatch(tree, DEFAULT_TABLE)
    const bg1 = findByName(promoted, '_BG1')[0]
    expect(bg1.isAnimationFolder).toBe(false)
  })

  it('変更がない場合は元のツリー参照をそのまま返す', () => {
    const psd = makePsd({
      children: [
        makeFolder('_memo', [makeLayer({ name: '何か' })]),
      ],
    })
    const tree = buildLayerTree(psd, undefined, [])
    const promoted = promoteAutoMarkedByProcessMatch(tree, DEFAULT_TABLE)
    expect(promoted).toBe(tree)
  })
})

// 祖先ガードテスト用: autoMarked が立った空フォルダのスタブ
function makeAutoMarkedStub(name: string): CspLayer {
  return {
    id: `stub-${name}-${Math.random()}`,
    name: name.startsWith('_') ? name.slice(1) : name,
    originalName: name,
    // agPsdRef はテスト内で参照されないので any で埋める
    agPsdRef: {} as never,
    children: [],
    parentId: null,
    depth: 0,
    blendMode: 'normal',
    opacity: 100,
    hidden: false,
    clipping: false,
    isFolder: true,
    isAnimationFolder: false,
    top: 0,
    left: 0,
    width: 100,
    height: 100,
    animationFolder: null,
    singleMark: false,
    autoMarked: true,
    virtualSetMembership: [],
    uiHidden: false,
    expanded: true,
    hasAdjustmentLayer: false,
  }
}
