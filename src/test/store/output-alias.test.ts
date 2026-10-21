import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildLayerTree, detectAnimationFoldersByXdts } from '../../engine/tree-builder'
import { useAppStore } from '../../store'
import { selectLayerTreeWithVisibility, selectOutputAliasTargets, selectOutputFiles, selectOutputNavigation } from '../../store/selectors'
import { planExportEntriesFromState } from '../../utils/export-entries'
import { previewOutputAlias } from '../../utils/output-alias-preview'
import { prepareOutputEntries } from '../../utils/output-builder'
import { DEFAULT_OUTPUT_CONFIG, type TimelineData } from '../../types'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

const state = () => useAppStore.getState()
const files = () => selectOutputFiles(state())
function fixture() {
  const psd = makePsd({ children: [makeFolder('A', [makeLayer({ name: 'A1' }), makeLayer({ name: 'A2' })]),
    makeFolder('_BG', [makeLayer()]), makeFolder('_container', [makeFolder('_sub', [makeLayer()])])] })
  state().loadParsedPsd(psd, 'alias.psd')
  const anim = state().layerTree.find(layer => layer.originalName === 'A')!
  const bg = state().layerTree.find(layer => layer.originalName === '_BG')!
  state().toggleManualAnimFolder(anim.id)
  state().clearHistory()
  return { anim, bg }
}

beforeEach(resetTestStore)
afterEach(() => { vi.restoreAllMocks(); resetTestStore() })

describe('output aliases', () => {
  it.each(['clip', 'xdts'] as const)('respects omitted native prefixes while renaming the output directory (%s)', detectedBy => {
    const { anim } = fixture()
    useAppStore.setState({ layerTree: state().layerTree.map(layer => layer.id === anim.id
      ? { ...layer, isAnimationFolder: true, animationFolder: { detectedBy, trackName: 'A', trackNo: 0 } } : layer),
      projectSettings: { ...state().projectSettings, includeXdtsTrackPrefixInCellName: false },
      outputConfig: { ...state().outputConfig, structure: 'hierarchy' } })
    state().setOutputAlias(anim.id, '別名')
    expect(files().filter(file => file.animFolderId === anim.id).map(file => file.relativePath)).toEqual(['別名/A2.jpg', '別名/A1.jpg'])
  })

  it('uses the effective role for underscore and dictionary folders, without changing detection', () => {
    const tree = buildLayerTree(makePsd({ children: [
      makeFolder('_A', [makeFolder('EN', [makeLayer()])]),
      makeFolder('指示', [makeFolder('EN', [makeLayer()])]),
      makeFolder('背景', [makeLayer()]),
    ] }), undefined, [], ['指示', '背景'])
    useAppStore.setState({ layerTree: tree, docWidth: 100, docHeight: 100,
      projectSettings: { ...state().projectSettings, processTable: [{ suffix: '_e', folderNames: ['EN'] }] } })
    for (const layer of tree) state().setOutputAlias(layer.id, `別名${layer.originalName}`)
    const effective = selectLayerTreeWithVisibility(state())
    expect(effective.filter(layer => layer.animationFolder?.detectedBy === 'autoProcess')).toHaveLength(2)
    expect(state().outputAliases.size).toBe(3)
    expect(files().every(file => file.fileName.startsWith('別名'))).toBe(true)
    expect(effective.map(layer => layer.originalName)).toEqual(tree.map(layer => layer.originalName))
  })

  it('renames metadata only, preserving source, output IDs, gates, image keys and export names', () => {
    const { anim } = fixture()
    const original = files().filter(file => file.animFolderId === anim.id)
    const effectiveTree = selectLayerTreeWithVisibility(state())
    state().setOutputsEnabled(new Set([original[0].outputId]), false)
    state().setOutputAlias(anim.id, 'B')
    const renamed = files().filter(file => file.animFolderId === anim.id)
    expect(renamed.map(file => file.relativePath)).toEqual(['B2.jpg', 'B1.jpg'])
    expect(renamed.map(({ outputId, gateId, renderKey }) => ({ outputId, gateId, renderKey })))
      .toEqual(original.map(({ outputId, gateId, renderKey }) => ({ outputId, gateId, renderKey })))
    expect(selectLayerTreeWithVisibility(state())).toBe(effectiveTree)
    expect(anim.originalName).toBe('A')
    expect(anim.agPsdRef.name).toBe('A')
    expect(selectOutputNavigation(state()).entries.some(entry => entry.label.startsWith('B /'))).toBe(true)
    const exported = planExportEntriesFromState(state()).map(entry => entry.prepared!.relativePath)
    expect(exported).not.toContain(renamed[0].relativePath)
    expect(exported).toContain(renamed[1].relativePath)
    state().setFormat('png'); state().setStructure('hierarchy')
    expect(files().find(file => file.outputId === original[0].outputId)!.relativePath).toBe('B/B2.png')
    expect(state().outputExclusions.has(original[0].gateId)).toBe(true)
  })

  it('keeps aliases dormant through role changes and preserves hidden or excluded targets', () => {
    const { anim, bg } = fixture()
    state().setOutputAlias(anim.id, 'C')
    state().toggleManualAnimFolder(anim.id)
    expect(selectOutputAliasTargets(state()).has(anim.id)).toBe(false)
    expect(state().outputAliases.get(anim.id)).toBe('C')
    state().toggleSingleMark(anim.id)
    expect(files().find(file => file.sourceLayerId === anim.id)!.relativePath).toBe('C.jpg')
    state().toggleLayerVisibility(anim.id)
    state().setOutputAlias(anim.id, 'D')
    expect(files().some(file => file.sourceLayerId === anim.id)).toBe(false)
    state().toggleLayerVisibility(anim.id)
    state().toggleManualAnimFolder(anim.id)
    expect(files().filter(file => file.animFolderId === anim.id).map(file => file.relativePath)).toEqual(['D2.jpg', 'D1.jpg'])
    state().setExcludeAutoMarked(true)
    state().setOutputAlias(bg.id, '背景')
    expect(state().outputAliases.get(bg.id)).toBe('背景')
    const targets = [...selectOutputAliasTargets(state()).values()].map(layer => layer.originalName)
    expect(targets).toContain('_sub')
    expect(targets).not.toContain('_container')
    state().setOutputAlias(anim.children[0].id, 'no')
    expect(state().outputAliases.has(anim.children[0].id)).toBe(false)
  })

  it('records one Undo per real edit, restores aliases, and clears them for a new document', () => {
    const { bg } = fixture()
    state().setOutputAlias(bg.id, '背景')
    state().setOutputAlias(bg.id, '背景')
    state().setOutputAlias(bg.id, '   ')
    expect(state()._past).toHaveLength(1)
    state().undo(); expect(state().outputAliases.size).toBe(0)
    state().redo(); expect(state().outputAliases.get(bg.id)).toBe('背景')
    state().resetOutputAlias(bg.id); expect(state().outputAliases.size).toBe(0)
    state().undo(); expect(state().outputAliases.get(bg.id)).toBe('背景')
    state().loadParsedPsd(makePsd({ children: [makeFolder('_BG', [makeLayer()])] }), 'next.psd')
    expect(state().outputAliases.size).toBe(0)
    state().setOutputAlias(state().layerTree[0].id, 'new')
    state().resetProject(); expect(state().outputAliases.size).toBe(0)
  })

  it('sanitizes a draft as one segment and previews actual collision names without mutating state or rendering', () => {
    const { anim, bg } = fixture()
    const create = vi.spyOn(document, 'createElement')
    const preview = previewOutputAlias(state(), anim.id, ' ../A\\B? ')
    expect(preview.value).toBe('_A_B_')
    expect(preview.notes).toHaveLength(1)
    expect(state().outputAliases.size).toBe(0)
    expect(create).not.toHaveBeenCalled()
    state().setOutputAlias(anim.id, ' ../A\\B? ')
    expect(files().filter(file => file.animFolderId === anim.id).every(file => file.segments.length === 1)).toBe(true)
    state().setOutputAlias(bg.id, 'CON')
    expect(files().find(file => file.sourceLayerId === bg.id)!.fileName).toBe('_CON.jpg')
    state().setOutputAlias(anim.id, 'B')
    const collision = previewOutputAlias(state(), bg.id, 'b1')
    expect(collision.names).toEqual(['b1.jpg']) // Tree order reserves this name first.
    expect(collision.notes.join(' ')).toContain('B1_2.jpg')
    state().setOutputAlias(bg.id, 'b1')
    expect(files().map(file => file.fileName)).toContain('B1_2.jpg')
    const single = files().find(file => file.sourceLayerId === bg.id)!
    const subset = planExportEntriesFromState(state(), state().outputConfig, new Set([single.outputId]))
    expect(subset[0].prepared!.relativePath).toBe(single.relativePath)
  })

  it('keeps long UTF-8 collision suffixes within 255 bytes with extensions intact', () => {
    const name = 'あ'.repeat(100) + '.png'
    const entries = prepareOutputEntries(Array.from({ length: 12 }, () => ({ path: `folder.with.dots/${name}`, flatName: name })),
      { ...DEFAULT_OUTPUT_CONFIG, format: 'png', structure: 'hierarchy' })
    expect(new Set(entries.map(entry => entry.fileName)).size).toBe(12)
    expect(entries[11].fileName).toMatch(/_12\.png$/)
    for (const entry of entries) {
      expect(new TextEncoder().encode(entry.fileName).length).toBeLessThanOrEqual(255)
      expect(entry.relativePath).toMatch(/^folder\.with\.dots\//)
      expect(entry.fileName).not.toContain('\uFFFD')
    }
  })

  it('keeps disambiguated long animation folders separate after sanitization', () => {
    const { anim, bg } = fixture()
    state().toggleManualAnimFolder(bg.id)
    state().setStructure('hierarchy')
    state().setOutputAlias(anim.id, 'あ'.repeat(100))
    state().setOutputAlias(bg.id, 'あ'.repeat(100))
    const folders = files().filter(file => file.animFolderId === anim.id || file.animFolderId === bg.id).map(file => file.segments[0])
    expect(new Set(folders).size).toBe(2)
    expect(folders.some(folder => folder.endsWith('(2)'))).toBe(true)
    expect(folders.every(folder => new TextEncoder().encode(folder).length <= 255)).toBe(true)
  })

  it('keeps sheet sequence numbers across process tracks even when their output aliases differ', () => {
    const tree = buildLayerTree(makePsd({ children: [
      makeFolder('A', ['A1', 'A2', 'A3'].map(name => makeLayer({ name }))),
      makeFolder('EN', [makeFolder('A', ['A2修正', 'A2追加', 'A3修正'].map(name => makeLayer({ name })))])
    ] }))
    const timeline: TimelineData = { version: 5, header: { cut: '', scene: '' }, timeTableName: 'test', duration: 12, fps: 24,
      tracks: [
        { name: 'A', trackNo: 0, cellNames: ['A1', 'A2', 'A3'], frames: [0, 5, 9].map((frameIndex, i) => ({ frameIndex, cellName: ['A1', 'A2', 'A3'][i] })) },
        { name: 'A', trackNo: 1, cellNames: ['A2修正', 'A2追加', 'A3修正'], frames: [5, 7, 9].map((frameIndex, i) => ({ frameIndex, cellName: ['A2修正', 'A2追加', 'A3修正'][i] })) },
      ] }
    detectAnimationFoldersByXdts(tree, timeline)
    useAppStore.setState({ layerTree: tree, timelineData: timeline, docWidth: 100, docHeight: 100,
      projectSettings: { ...state().projectSettings, cellNamingMode: 'sheet-sequence', processTable: [{ suffix: '_e', folderNames: ['EN'] }] } })
    const before = files().map(file => [file.outputId, file.relativePath.match(/_(\d+)/)?.[1]])
    const anim = tree.find(layer => layer.isAnimationFolder)!
    expect(files().filter(file => file.animFolderId === anim.id).map(file => file.fileName).sort()).toEqual(['A_1.jpg', 'A_2.jpg', 'A_4.jpg'])
    state().setOutputAlias(anim.id, 'B')
    expect(files().map(file => [file.outputId, file.relativePath.match(/_(\d+)/)?.[1]])).toEqual(before)
  })
})
