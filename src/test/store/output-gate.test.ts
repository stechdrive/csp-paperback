import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { useAppStore } from '../../store'
import { selectOutputFiles } from '../../store/selectors'
import { selectEnabledOutputCount } from '../../store/output-gate-slice'
import { buildOutputEntriesFromState, planExportEntriesFromState } from '../../utils/export-entries'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

const state = () => useAppStore.getState()
const files = () => selectOutputFiles(state())
const off = () => files().filter(file => state().outputExclusions.has(file.gateId))
function fixture() {
  const tree = buildLayerTree(makePsd({ children: [
    makeFolder('_A:1', [makeLayer()]), makeFolder('_A?1', [makeLayer()]),
    makeAnimationFolder('A', [makeFolder('1', [makeLayer({ name: 'body' }),
      makeFolder('EN', [makeLayer({ name: 'line' })]), makeFolder('原画', [makeLayer({ name: 'color' })])])]),
  ] }))
  const anim = tree[0], cell = anim.children[0]
  anim.isAnimationFolder = true
  anim.animationFolder = { detectedBy: 'manual', trackName: 'A' }
  useAppStore.setState({ layerTree: tree, docWidth: 100, docHeight: 100,
    projectSettings: { ...state().projectSettings, cellNamingMode: 'sequence', processTable: [{ suffix: '_e', folderNames: ['EN', '原画'] }] } })
  return { anim, cell, process: cell.children.filter(layer => layer.isFolder), body: cell.children.find(layer => !layer.isFolder)! }
}

beforeEach(resetTestStore)
afterEach(() => { vi.restoreAllMocks(); resetTestStore() })

describe('document-local final export gate', () => {
  it('preserves OFF through naming, suffix, format, folder layout and appearance edits', () => {
    const { body } = fixture()
    const original = files().find(file => file.processSuffixes?.includes('_e'))!
    state().setOutputsEnabled(new Set([original.outputId]), false)
    state().setSequenceDigitMode('fixed-4')
    state().updateProcessTable([{ suffix: '_revision', folderNames: ['EN', '原画'] }])
    state().setFormat('png'); state().setStructure('hierarchy')
    state().setLayerOpacity(body.id, 30); state().setLayerBlendMode(body.id, 'multiply')
    state().setRevisionBorderEnabled(false)
    expect(off()).toHaveLength(1)
    expect(off()[0].gateId).toBe(original.gateId)
    expect(off()[0].relativePath).toBe('A/A_0001_revision.png')
    expect(off()[0].outputId).not.toBe(original.outputId)
    state().setProcessSuffixPosition('before-cell')
    expect(off()[0].relativePath).toBe('A/A_revision_0001.png')
    expect(planExportEntriesFromState(state()).some(entry => entry.prepared?.relativePath === off()[0].relativePath)).toBe(false)
    state().setOutputsEnabled(new Set([off()[0].outputId]), true)
    expect(off()).toEqual([])
  })

  it('keeps the complete process identity when aliases or entire outputs become temporarily invisible', () => {
    const { anim, process } = fixture()
    const original = files().find(file => file.processSuffixes?.includes('_e'))!
    state().setOutputsEnabled(new Set([original.outputId]), false)
    state().toggleLayerVisibility(process[0].id)
    expect(off()[0].gateId).toBe(original.gateId)
    expect(off()[0].sourceLayerId).not.toBe(original.sourceLayerId)
    state().toggleLayerVisibility(process[1].id)
    expect(off()).toEqual([])
    expect(state().outputExclusions.has(original.gateId)).toBe(true)
    state().toggleLayerVisibility(process[0].id)
    expect(off()[0].gateId).toBe(original.gateId)
    state().toggleProcessSuffixExclusion('_e')
    expect(off()).toEqual([])
    state().toggleProcessSuffixExclusion('_e')
    expect(off()[0].gateId).toBe(original.gateId)
    state().toggleLayerVisibility(anim.id)
    expect(off()).toEqual([])
    state().toggleLayerVisibility(anim.id)
    expect(off()[0].gateId).toBe(original.gateId)
  })

  it('treats new split groups as new outputs, and restores the old intent when the original group returns', () => {
    fixture()
    const original = files().find(file => file.processSuffixes?.includes('_e'))!
    state().setOutputsEnabled(new Set([original.outputId]), false)
    state().updateProcessTable([{ suffix: '_e', folderNames: ['EN'] }, { suffix: '_color', folderNames: ['原画'] }])
    expect(files().filter(file => file.processSuffixes?.length)).toHaveLength(2)
    expect(off()).toEqual([])
    state().undo()
    expect(off().map(file => file.gateId)).toEqual([original.gateId])
  })

  it('is undoable in one step per batch, including restore-all and edits between gate changes', () => {
    const { body } = fixture()
    const ids = new Set(files().map(file => file.outputId))
    state().setOutputsEnabled(ids, false)
    expect(selectEnabledOutputCount(state())).toBe(0)
    expect(state()._past).toHaveLength(1)
    state().setOutputsEnabled(ids, false)
    expect(state()._past).toHaveLength(1)
    state().setLayerOpacity(body.id, 50)
    state().undo()
    expect(off()).toHaveLength(ids.size)
    state().undo()
    expect(off()).toEqual([])
    state().redo()
    expect(off()).toHaveLength(ids.size)
    state().resetOutputExclusions()
    expect(state().outputExclusions.size).toBe(0)
    state().undo()
    expect(off()).toHaveLength(ids.size)
  })

  it('keeps virtual output OFF through edits and temporary unplacement', () => {
    const { body } = fixture()
    useAppStore.setState({ virtualSets: [{ id: 'virtual', name: 'one', insertionLayerId: body.id, insertionPosition: 'above',
      members: [{ layerId: body.id, opacity: null, blendMode: null }], expandToAnimationCells: false, visibilityOverrides: {} }] })
    const file = files().find(file => file.sourceLayerId === 'virtual')!
    state().setOutputsEnabled(new Set([file.outputId]), false)
    state().updateVirtualSet('virtual', { name: 'renamed', insertionLayerId: null })
    expect(off()).toEqual([])
    state().updateVirtualSet('virtual', { insertionLayerId: body.id, visibilityOverrides: { [body.id]: false } })
    expect(off().map(file => file.gateId)).toEqual([file.gateId])
    expect(off()[0].relativePath).toBe('renamed.jpg')
  })

  it('does not alter the manifest, render cache, visibility or saved output settings', () => {
    fixture()
    const before = state(), manifest = files()
    const create = vi.spyOn(document, 'createElement'), save = vi.spyOn(Storage.prototype, 'setItem')
    state().setOutputsEnabled(new Set(manifest.map(file => file.outputId)), false)
    expect(files()).toBe(manifest)
    expect(state().visibilityOverrides).toBe(before.visibilityOverrides)
    expect(state().outputConfig).toBe(before.outputConfig)
    expect(state().savedOutputConfig).toBe(before.savedOutputConfig)
    expect(create).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    expect(planExportEntriesFromState(state())).toEqual([])
  })

  it.each(['flat', 'hierarchy'] as const)('applies the gate after collision names and before rendering, also for selection and explicit config (%s)', structure => {
    fixture(); state().setStructure(structure)
    const before = files(), keep = before.at(-1)!
    const excluded = before.slice(0, -1)
    state().setOutputsEnabled(new Set(excluded.map(file => file.outputId)), false)
    const spies = excluded.map(file => vi.spyOn(file, 'renderCanvas'))
    const selectedIds = new Set(before.map(file => file.outputId))
    for (const build of [planExportEntriesFromState, buildOutputEntriesFromState]) {
      expect(build(state(), state().outputConfig, selectedIds).map(entry => entry.prepared?.relativePath)).toEqual([keep.relativePath])
      expect(build(state(), { ...state().outputConfig }, selectedIds).map(entry => entry.prepared?.relativePath)).toEqual([keep.relativePath])
      expect(build(state(), state().outputConfig, new Set([excluded[0].outputId]))).toEqual([])
    }
    expect(spies.every(spy => spy.mock.calls.length === 0)).toBe(true)
  })

  it('starts a new document with all outputs ON and clears the old undo history', () => {
    fixture()
    state().setOutputsEnabled(new Set(files().map(file => file.outputId)), false)
    state().loadParsedPsd(makePsd({ children: [makeFolder('_new', [makeLayer()])] }), 'new.psd')
    expect(state().outputExclusions.size).toBe(0)
    expect(state().canUndo).toBe(false)
    expect(off()).toEqual([])
    state().resetProject()
    expect(state().outputExclusions.size).toBe(0)
  })
})
