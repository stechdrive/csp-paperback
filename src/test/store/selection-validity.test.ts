import { beforeEach, describe, expect, it } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { useAppStore } from '../../store'
import { normalizePreviewSelection } from '../../store/selection-validity'
import { selectLayerTreeWithVisibility } from '../../store/selectors'
import { findLayerById } from '../../utils/layerNavigation'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

beforeEach(() => resetTestStore())

function setup() {
  const tree = buildLayerTree(makePsd({ children: [makeFolder('outer', [makeFolder('A', [
    makeFolder('1', [makeFolder('artwork', [makeLayer()])]),
  ])])] }))
  const outer = tree[0], anim = outer.children[0], cell = anim.children[0]
  const expandedFolders = new Set([outer.id])
  const userCollapsedFolders = new Set([anim.id])
  useAppStore.setState({ layerTree: tree, expandedFolders, userCollapsedFolders })
  return { tree, outer, anim, cell, expandedFolders, userCollapsedFolders }
}

function selectCell(animId: string, cellId: string, extraFolderId: string) {
  useAppStore.getState().selectAnimCell(animId, 0)
  useAppStore.setState({ selectedLayerId: cellId, selectedOutputSourceId: cellId,
    transientExpandedFolders: new Set([animId, cellId, extraFolderId]) })
}

describe('preview selection validity', () => {
  it('手動アニメ解除はatomicにfocusを外し、選択行の祖先だけを一時展開する', () => {
    const { anim, cell, expandedFolders, userCollapsedFolders } = setup()
    useAppStore.getState().toggleManualAnimFolder(anim.id)
    selectCell(anim.id, cell.id, cell.children[0].id)
    const invalidStates: string[] = []
    const unsubscribe = useAppStore.subscribe(state => {
      if (state.focusedAnimFolderId && !findLayerById(selectLayerTreeWithVisibility(state), state.focusedAnimFolderId)?.isAnimationFolder) {
        invalidStates.push(state.focusedAnimFolderId)
      }
    })
    useAppStore.getState().toggleManualAnimFolder(anim.id)
    unsubscribe()
    expect(invalidStates).toEqual([])
    expect(useAppStore.getState()).toMatchObject({ selectedLayerId: cell.id,
      focusedAnimFolderId: null, selectedOutputSourceId: null,
      transientExpandedFolders: new Set([anim.id]) })
    expect(useAppStore.getState().expandedFolders).toBe(expandedFolders)
    expect(useAppStore.getState().userCollapsedFolders).toBe(userCollapsedFolders)
  })

  it('手動アニメ指定のUndoは現在の選択行を残し、無効focusを残さない', () => {
    const { anim, cell } = setup()
    useAppStore.getState().toggleManualAnimFolder(anim.id)
    selectCell(anim.id, cell.id, cell.children[0].id)
    useAppStore.getState().undo()
    expect(useAppStore.getState()).toMatchObject({ selectedLayerId: cell.id,
      focusedAnimFolderId: null, selectedOutputSourceId: null,
      transientExpandedFolders: new Set([anim.id]) })
    useAppStore.getState().redo()
    expect(useAppStore.getState().selectedLayerId).toBe(cell.id)
    expect(useAppStore.getState().focusedAnimFolderId).toBeNull()
  })

  it('XDTS解除はfolder指定解除とselection正規化を同時に行う', () => {
    const { anim, cell } = setup()
    anim.isAnimationFolder = true
    anim.animationFolder = { detectedBy: 'xdts', trackName: 'A', trackNo: 0 }
    selectCell(anim.id, cell.id, cell.children[0].id)
    useAppStore.getState().clearXdts()
    expect(useAppStore.getState()).toMatchObject({ selectedLayerId: cell.id,
      focusedAnimFolderId: null, selectedOutputSourceId: null,
      transientExpandedFolders: new Set([anim.id]) })
  })

  it('非表示・工程除外だけでは巡回sourceを解除したり別出力へ移動しない', () => {
    const { outer, anim, cell } = setup()
    useAppStore.getState().toggleManualAnimFolder(anim.id)
    selectCell(anim.id, cell.id, cell.children[0].id)
    useAppStore.setState({ visibilityOverrides: new Map([[outer.id, true], [cell.id, true]]),
      outputConfig: { ...useAppStore.getState().outputConfig, excludedProcessSuffixes: ['_e'], excludeAutoMarked: true } })
    expect(normalizePreviewSelection(useAppStore.getState())).toEqual({})
  })

  it('削除されたsourceと選択行は解除し、残るフォルダの別セルへ移動しない', () => {
    const { anim, cell } = setup()
    useAppStore.getState().toggleManualAnimFolder(anim.id)
    selectCell(anim.id, cell.id, cell.children[0].id)
    const state = useAppStore.getState()
    const nextTree = state.layerTree.map(outer => ({ ...outer,
      children: outer.children.map(folder => ({ ...folder, children: [] })),
    }))
    expect(normalizePreviewSelection({ ...state, layerTree: nextTree })).toMatchObject({
      selectedLayerId: null, focusedAnimFolderId: null, selectedOutputSourceId: null,
      transientExpandedFolders: new Set(),
    })
  })

  it('focusのない単体出力sourceは有効な選択として維持する', () => {
    const { cell } = setup()
    useAppStore.setState({ selectedLayerId: cell.id, selectedOutputSourceId: cell.id, focusedAnimFolderId: null })
    expect(normalizePreviewSelection(useAppStore.getState())).toEqual({})
  })
})
