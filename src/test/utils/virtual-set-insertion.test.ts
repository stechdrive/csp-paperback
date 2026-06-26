import { describe, expect, it } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import {
  resolveVirtualSetFolderChildInsertionTarget,
  resolveVirtualSetInsertionTarget,
} from '../../utils/virtual-set-insertion'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'

describe('resolveVirtualSetInsertionTarget', () => {
  it('同階層フォルダ間の下半分ドロップは次の兄弟の上として保存する', () => {
    const tree = buildLayerTree(makePsd({
      children: [
        makeFolder('bottom-folder', []),
        makeFolder('top-folder', [makeLayer({ name: 'child' })]),
      ],
    }))
    const topFolder = tree[0]
    const bottomFolder = tree[1]

    expect(resolveVirtualSetInsertionTarget(tree, topFolder.id, 'below')).toEqual({
      insertionLayerId: bottomFolder.id,
      insertionPosition: 'above',
    })
  })

  it('同階層の最後の下はそのレイヤーの下として保存する', () => {
    const tree = buildLayerTree(makePsd({
      children: [
        makeFolder('bottom-folder', []),
        makeFolder('top-folder', []),
      ],
    }))
    const bottomFolder = tree[1]

    expect(resolveVirtualSetInsertionTarget(tree, bottomFolder.id, 'below')).toEqual({
      insertionLayerId: bottomFolder.id,
      insertionPosition: 'below',
    })
  })

  it('上半分ドロップは対象レイヤーの上として保存する', () => {
    const tree = buildLayerTree(makePsd({
      children: [
        makeLayer({ name: 'bottom-layer' }),
        makeLayer({ name: 'top-layer' }),
      ],
    }))
    const bottomLayer = tree[1]

    expect(resolveVirtualSetInsertionTarget(tree, bottomLayer.id, 'above')).toEqual({
      insertionLayerId: bottomLayer.id,
      insertionPosition: 'above',
    })
  })

  it('フォルダ配下ドロップはフォルダ内先頭レイヤーの上として保存する', () => {
    const tree = buildLayerTree(makePsd({
      children: [
        makeFolder('folder', [
          makeLayer({ name: 'bottom-child' }),
          makeLayer({ name: 'top-child' }),
        ]),
      ],
    }))
    const folder = tree[0]
    const topChild = folder.children[0]

    expect(resolveVirtualSetFolderChildInsertionTarget(tree, folder.id)).toEqual({
      insertionLayerId: topChild.id,
      insertionPosition: 'above',
    })
  })

  it('空フォルダは配下挿入先に解決しない', () => {
    const tree = buildLayerTree(makePsd({
      children: [
        makeFolder('empty-folder', []),
      ],
    }))

    expect(resolveVirtualSetFolderChildInsertionTarget(tree, tree[0].id)).toBeNull()
  })
})
