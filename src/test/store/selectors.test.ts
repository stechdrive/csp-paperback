import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../store'
import {
  selectLayerTreeWithVisibility,
  selectAnimationFolders,
  selectLayerById,
  selectMarkedLayerIds,
  selectProcessTableErrors,
} from '../../store/selectors'
import { buildLayerTree } from '../../engine/tree-builder'
import { makeLayer, makePsd, makeFolder } from '../helpers/psd-factory'
import { DEFAULT_PROJECT_SETTINGS } from '../../types'

beforeEach(() => {
  useAppStore.setState({
    rawPsd: null,
    psdFileName: null,
    layerTree: [],
    docWidth: 0,
    docHeight: 0,
    singleMarks: new Map(),
    virtualSets: [],
    visibilityOverrides: new Map(),
    expandedFolders: new Set(),
    manualAnimFolderIds: new Set(),
    folderModes: new Map(),
    projectSettings: DEFAULT_PROJECT_SETTINGS,
  })
})

describe('selectLayerTreeWithVisibility', () => {
  it('visibilityOverridesがない場合はそのままツリーを返す', () => {
    const psd = makePsd({ children: [makeLayer({ name: 'layer' })] })
    const tree = buildLayerTree(psd)
    useAppStore.setState({ layerTree: tree, visibilityOverrides: new Map() })
    const result = selectLayerTreeWithVisibility(useAppStore.getState())
    expect(result).toBe(tree) // 同一参照
  })

  it('visibilityOverridesを反映してuiHiddenを設定する', () => {
    const psd = makePsd({ children: [makeLayer({ name: 'layer' })] })
    const tree = buildLayerTree(psd)
    const overrides = new Map([[tree[0].id, true]])
    useAppStore.setState({ layerTree: tree, visibilityOverrides: overrides })
    const result = selectLayerTreeWithVisibility(useAppStore.getState())
    expect(result[0].uiHidden).toBe(true)
    expect(tree[0].uiHidden).toBe(false) // 元のツリーは変更されない
  })
})

describe('selectLayerById', () => {
  it('IDでレイヤーを検索する', () => {
    const psd = makePsd({ children: [makeLayer({ name: 'target' })] })
    const tree = buildLayerTree(psd)
    useAppStore.setState({ layerTree: tree })
    const found = selectLayerById(useAppStore.getState(), tree[0].id)
    expect(found?.originalName).toBe('target')
  })

  it('存在しないIDはnullを返す', () => {
    useAppStore.setState({ layerTree: [] })
    const found = selectLayerById(useAppStore.getState(), 'nonexistent')
    expect(found).toBeNull()
  })

  it('ネストされたレイヤーも検索できる', () => {
    const child = makeLayer({ name: 'child' })
    const psd = makePsd({ children: [makeFolder('parent', [child])] })
    const tree = buildLayerTree(psd)
    useAppStore.setState({ layerTree: tree })
    const childNode = tree[0].children[0]
    const found = selectLayerById(useAppStore.getState(), childNode.id)
    expect(found?.originalName).toBe('child')
  })
})

describe('selectMarkedLayerIds', () => {
  it('_プレフィックスフォルダのIDを返す', () => {
    const psd = makePsd({ children: [makeFolder('_撮影指示', [])] })
    const tree = buildLayerTree(psd)
    useAppStore.setState({ layerTree: tree })
    const ids = selectMarkedLayerIds(useAppStore.getState())
    expect(ids.has(tree[0].id)).toBe(true)
  })

  it('シングルマーク済みレイヤーのIDも返す', () => {
    const psd = makePsd({ children: [makeLayer({ name: 'marked' })] })
    const tree = buildLayerTree(psd)
    useAppStore.setState({
      layerTree: tree,
      singleMarks: new Map([[tree[0].id, { layerId: tree[0].id, origin: 'manual' }]]),
    })
    const ids = selectMarkedLayerIds(useAppStore.getState())
    expect(ids.has(tree[0].id)).toBe(true)
  })
})

describe('selectAnimationFolders', () => {
  it('isAnimationFolderのレイヤーを返す', () => {
    const psd = makePsd({ children: [makeFolder('A', [])] })
    const tree = buildLayerTree(psd)
    tree[0].isAnimationFolder = true
    useAppStore.setState({ layerTree: tree, manualAnimFolderIds: new Set() })
    const animFolders = selectAnimationFolders(useAppStore.getState())
    expect(animFolders).toHaveLength(1)
    expect(animFolders[0].originalName).toBe('A')
  })

  it('手動指定IDも含める', () => {
    const psd = makePsd({ children: [makeFolder('B', [])] })
    const tree = buildLayerTree(psd)
    useAppStore.setState({ layerTree: tree, manualAnimFolderIds: new Set([tree[0].id]) })
    const animFolders = selectAnimationFolders(useAppStore.getState())
    expect(animFolders).toHaveLength(1)
  })
})

describe('selectProcessTableErrors', () => {
  it('重複なしは空Setを返す', () => {
    useAppStore.setState({
      projectSettings: {
        ...DEFAULT_PROJECT_SETTINGS,
        processTable: [
          { suffix: '_en', folderNames: ['EN'] },
          { suffix: '_ka', folderNames: ['KA'] },
        ],
      },
    })
    const errors = selectProcessTableErrors(useAppStore.getState())
    expect(errors.size).toBe(0)
  })

  it('同一フォルダ名が複数サフィックスにある場合はエラーを返す', () => {
    useAppStore.setState({
      projectSettings: {
        ...DEFAULT_PROJECT_SETTINGS,
        processTable: [
          { suffix: '_en', folderNames: ['EN', '演出修正'] },
          { suffix: '_ka', folderNames: ['EN'] }, // ENが重複
        ],
      },
    })
    const errors = selectProcessTableErrors(useAppStore.getState())
    expect(errors.size).toBeGreaterThan(0)
  })
})
