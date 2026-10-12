import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { useAppStore } from '../../store'
import { selectOutputFiles, selectOutputNavigation } from '../../store/selectors'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS, type VirtualSet } from '../../types'
import { buildOutputEntriesFromState } from '../../utils/export-entries'
import { prepareOutputEntries } from '../../utils/output-builder'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

beforeEach(resetTestStore)
afterEach(() => { vi.restoreAllMocks(); resetTestStore() })

function fixture() {
  const tree = buildLayerTree(makePsd({ children: [
    makeFolder('_A:1', [makeLayer()]), makeFolder('_A?1', [makeLayer()]),
    makeAnimationFolder('A', [makeFolder('1', [makeLayer({ name: 'body' }),
      makeFolder('EN', [makeLayer({ name: 'process' })])])]),
  ] }))
  const anim = tree[0]
  anim.isAnimationFolder = true
  anim.animationFolder = { detectedBy: 'manual', trackName: 'A' }
  const vs: VirtualSet = { id: 'vs', name: '_A?1', insertionLayerId: anim.id, insertionPosition: 'above',
    members: [{ layerId: tree[1].id, opacity: null, blendMode: null }],
    expandToAnimationCells: false, visibilityOverrides: {} }
  useAppStore.setState({ layerTree: tree, virtualSets: [vs, { ...vs, id: 'unplaced', insertionLayerId: null }],
    docWidth: 100, docHeight: 100,
    projectSettings: { ...DEFAULT_PROJECT_SETTINGS, cellNamingMode: 'sequence', processTable: [{ suffix: '_e', folderNames: ['EN'] }] },
  })
  return { tree, anim }
}

describe('output file plan', () => {
  it('lists real outputs without creating canvases, including sanitized collisions and virtual cells', () => {
    fixture()
    const create = vi.spyOn(document, 'createElement')
    const files = selectOutputFiles(useAppStore.getState())
    expect(create).not.toHaveBeenCalled()
    expect(files.map(file => file.relativePath)).toEqual(['A_1.jpg', 'A_1_e.jpg', '_A_1.jpg', '_A_1_2.jpg', '_A_1_3.jpg'])
    expect(new Set(files.map(file => file.sourceLayerId))).toEqual(new Set(selectOutputNavigation(useAppStore.getState()).entries.map(entry => entry.id)))
    const exported = prepareOutputEntries(buildOutputEntriesFromState(useAppStore.getState()), useAppStore.getState().outputConfig)
    expect(files.map(file => file.relativePath)).toEqual(exported.map(file => file.relativePath))
  })

  it('updates hierarchy, format, naming, process exclusion and visibility but ignores expansion and selection', () => {
    const { anim } = fixture()
    const first = selectOutputFiles(useAppStore.getState())
    useAppStore.setState({ expandedFolders: new Set([anim.id]), selectedLayerId: anim.id, currentFrame: 3 })
    expect(selectOutputFiles(useAppStore.getState())).toBe(first)
    useAppStore.setState({ outputConfig: { ...DEFAULT_OUTPUT_CONFIG, format: 'png', structure: 'hierarchy', excludedProcessSuffixes: ['_e'], excludeAutoMarked: true } })
    expect(selectOutputFiles(useAppStore.getState()).map(file => file.relativePath)).toEqual(['A/A_1.png', '_A_1.png'])
    useAppStore.getState().toggleLayerVisibility(anim.id)
    expect(selectOutputFiles(useAppStore.getState()).map(file => file.relativePath)).toEqual(['_A_1.png'])
    useAppStore.getState().toggleLayerVisibility(anim.id)
    useAppStore.setState({ projectSettings: { ...useAppStore.getState().projectSettings, sequenceDigitMode: 'fixed-4' } })
    expect(selectOutputFiles(useAppStore.getState())[0].relativePath).toBe('A/A_0001.png')
  })
})
