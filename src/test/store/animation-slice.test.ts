import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../store'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { selectLayerTreeWithVisibility } from '../../store/selectors'
import { sanitizeManualAnimFolderIds } from '../../utils/manual-animation-folder'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS, type CspLayer, type XdtsData } from '../../types'

function resetStore() {
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
    projectSettings: DEFAULT_PROJECT_SETTINGS,
    outputConfig: DEFAULT_OUTPUT_CONFIG,
    xdtsData: null,
    xdtsFileName: null,
    unmatchedTracks: [],
    selectedCells: new Map(),
    focusedAnimFolderId: null,
    selectedVirtualSetId: null,
    currentFrame: 0,
    _past: [],
    _future: [],
    canUndo: false,
    canRedo: false,
  })
}

function findByOriginalName(layers: CspLayer[], name: string): CspLayer {
  for (const layer of layers) {
    if (layer.originalName === name) return layer
    const found = layer.children.length > 0 ? findByOriginalNameOrNull(layer.children, name) : null
    if (found) return found
  }
  throw new Error(`Layer not found: ${name}`)
}

function findByOriginalNameOrNull(layers: CspLayer[], name: string): CspLayer | null {
  for (const layer of layers) {
    if (layer.originalName === name) return layer
    const found = findByOriginalNameOrNull(layer.children, name)
    if (found) return found
  }
  return null
}

function makeXdts(trackName: string): XdtsData {
  return {
    tracks: [{ name: trackName, trackNo: 0, cellNames: [], frames: [] }],
    version: 5,
    header: { cut: '1', scene: '1' },
    timeTableName: 'タイムライン1',
    duration: 24,
    fps: 24,
  }
}

beforeEach(() => resetStore())

describe('toggleManualAnimFolder', () => {
  it('通常フォルダを手動アニメーションフォルダとしてトグルできる', () => {
    const tree = buildLayerTree(makePsd({
      children: [makeFolder('_原図', [makeFolder('_BOOK1', [makeLayer({ name: '1' })])])],
    }))
    const book = findByOriginalName(tree, '_BOOK1')
    useAppStore.setState({ layerTree: tree })

    useAppStore.getState().toggleManualAnimFolder(book.id)
    expect(useAppStore.getState().manualAnimFolderIds.has(book.id)).toBe(true)

    const effectiveTree = selectLayerTreeWithVisibility(useAppStore.getState())
    const effectiveBook = findByOriginalName(effectiveTree, '_BOOK1')
    expect(effectiveBook.isAnimationFolder).toBe(true)
    expect(effectiveBook.animationFolder?.detectedBy).toBe('manual')

    useAppStore.getState().toggleManualAnimFolder(book.id)
    expect(useAppStore.getState().manualAnimFolderIds.has(book.id)).toBe(false)
  })

  it('単体レイヤーとXDTS検出済みフォルダには手動指定を付けない', () => {
    const tree = buildLayerTree(makePsd({
      children: [
        makeLayer({ name: 'single' }),
        makeFolder('A', [makeLayer({ name: '1' })]),
      ],
    }))
    const xdts = makeXdts('A')
    detectAnimationFoldersByXdts(tree, xdts)
    const single = findByOriginalName(tree, 'single')
    const detected = findByOriginalName(tree, 'A')
    useAppStore.setState({ layerTree: tree, xdtsData: xdts })

    useAppStore.getState().toggleManualAnimFolder(single.id)
    useAppStore.getState().toggleManualAnimFolder(detected.id)

    expect(useAppStore.getState().manualAnimFolderIds.size).toBe(0)
  })

  it('既存アニメーションフォルダの祖先・子孫には手動指定を重ねない', () => {
    const tree = buildLayerTree(makePsd({
      children: [
        makeFolder('Parent', [
          makeFolder('A', [
            makeFolder('Nested', [makeLayer({ name: 'line' })]),
          ]),
        ]),
      ],
    }))
    const xdts = makeXdts('A')
    detectAnimationFoldersByXdts(tree, xdts)
    const parent = findByOriginalName(tree, 'Parent')
    const nested = findByOriginalName(tree, 'Nested')
    useAppStore.setState({ layerTree: tree, xdtsData: xdts })

    useAppStore.getState().toggleManualAnimFolder(parent.id)
    useAppStore.getState().toggleManualAnimFolder(nested.id)

    expect(useAppStore.getState().manualAnimFolderIds.size).toBe(0)
  })

  it('復元済み手動指定IDがXDTS検出済みに重なる場合はサニタイズで除外する', () => {
    const tree = buildLayerTree(makePsd({
      children: [
        makeFolder('A', [makeLayer({ name: '1' })]),
        makeFolder('_BOOK1', [makeLayer({ name: '1' })]),
      ],
    }))
    const xdts = makeXdts('A')
    detectAnimationFoldersByXdts(tree, xdts)
    const detected = findByOriginalName(tree, 'A')
    const manualBook = findByOriginalName(tree, '_BOOK1')

    const sanitized = sanitizeManualAnimFolderIds(
      tree,
      new Set([detected.id, manualBook.id]),
    )

    expect(sanitized.has(detected.id)).toBe(false)
    expect(sanitized.has(manualBook.id)).toBe(true)
  })
})
