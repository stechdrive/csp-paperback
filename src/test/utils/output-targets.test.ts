import { afterEach, describe, expect, it } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { useAppStore } from '../../store'
import { selectLayerTreeWithVisibility, selectOutputCandidates, selectOutputFiles, selectOutputNavigation, selectOutputRowStatuses } from '../../store/selectors'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'
import { buildOutputEntriesFromState } from '../../utils/export-entries'
import { buildDefaultVisibilityOverrides } from '../../utils/default-visibility'
import { individualOutputKey, individualOutputName, isIndividualOutputEnabled } from '../../utils/output-target'
import { DEFAULT_OUTPUT_CONFIG } from '../../types'

afterEach(() => resetTestStore())

function fixture() {
  const tree = buildLayerTree(makePsd({ children: [
    makeFolder('A', [makeFolder('001', [makeLayer({ name: 'body' }), makeFolder('作監', [makeLayer({ name: 'correction' })])])]),
    makeFolder('演出', [makeFolder('B', [makeLayer({ name: '001' })])]),
    makeFolder('_撮影指示', [makeLayer()]),
    makeFolder('_撮影指示', [makeLayer()]),
    makeFolder('_BG', [makeFolder('原画', [makeLayer()]), makeFolder('_e', [makeLayer()])]),
    makeFolder('_整理', [makeFolder('_BOOK', [makeLayer()])]),
  ] }))
  const anim = tree.find(layer => layer.originalName === 'A')!
  const revision = tree.find(layer => layer.originalName === '演出')!.children[0]
  resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100,
    manualAnimFolderIds: new Set([anim.id, revision.id]) })
  return { tree, anim, revision, cell: anim.children[0],
    body: anim.children[0].children.find(l => l.originalName === 'body')!,
    correction: anim.children[0].children.find(l => l.originalName === '作監')!,
    individual: tree.filter(l => l.originalName === '_撮影指示') }
}

describe('output target selection', () => {
  it('keeps a second underscore in material names and ignores inherited object keys', () => {
    expect(individualOutputKey(individualOutputName('__BG'))).toBe('_bg')
    expect(individualOutputKey(individualOutputName('_BG'))).toBe('bg')
    const config = { ...DEFAULT_OUTPUT_CONFIG, excludeAutoMarked: true }
    expect(isIndividualOutputEnabled({ body: false, processSuffixes: [], individualName: 'constructor', legacyAutoMarked: true }, config)).toBe(false)
  })
  it('excludes the body without hiding its eye or dropping cell-internal and separate-track revisions', () => {
    const { anim, cell, body, correction, revision } = fixture()
    const tree = selectLayerTreeWithVisibility(useAppStore.getState())
    const eyes = useAppStore.getState().visibilityOverrides
    useAppStore.getState().setExcludeBody(true)
    const state = useAppStore.getState()
    const files = selectOutputFiles(state)
    expect(files.some(f => f.sourceLayerId === cell.id)).toBe(false)
    expect(files.some(f => f.sourceLayerId === correction.id)).toBe(true)
    expect(files.some(f => f.animFolderId === revision.id)).toBe(true)
    expect(selectLayerTreeWithVisibility(state)).toBe(tree)
    expect(state.visibilityOverrides).toBe(eyes)
    expect(selectOutputRowStatuses(state).get(anim.id)).toEqual({ total: 2, excluded: 1 })
    expect(selectOutputRowStatuses(state).get(body.id)).toEqual({ total: 1, excluded: 1 })
    expect(selectOutputNavigation(state).entries.map(e => e.id).sort()).toEqual(files.map(f => f.sourceLayerId).sort())
    expect(buildOutputEntriesFromState(state).map(e => e.sourceLayerId).sort()).toEqual(files.map(f => f.sourceLayerId).sort())
    state.undo()
    expect(selectOutputFiles(useAppStore.getState()).some(f => f.sourceLayerId === cell.id)).toBe(true)
  })

  it('groups individual outputs by name, retains choices after OFF, and preserves other material', () => {
    const { individual } = fixture()
    const candidates = selectOutputCandidates(useAppStore.getState())
    expect(candidates.some(e => e.outputTarget?.individualName === '整理')).toBe(false)
    useAppStore.getState().setIndividualOutputEnabled('撮影指示', false)
    expect(selectOutputCandidates(useAppStore.getState())).toBe(candidates)
    const files = selectOutputFiles(useAppStore.getState())
    expect(files.some(f => individual.some(l => l.id === f.sourceLayerId))).toBe(false)
    expect(files.some(f => f.outputTarget?.individualName === 'BOOK')).toBe(true)
    useAppStore.getState().undo()
    expect(selectOutputFiles(useAppStore.getState()).filter(f => individual.some(l => l.id === f.sourceLayerId))).toHaveLength(2)
  })

  it('treats automatically expanded BG as individual material and matches its direct revision cells', () => {
    fixture()
    useAppStore.getState().setExcludeBody(true)
    let files = selectOutputFiles(useAppStore.getState()).filter(f => f.outputTarget?.individualName === 'BG')
    expect(files).toHaveLength(2)
    useAppStore.getState().toggleProcessSuffixExclusion('_e')
    files = selectOutputFiles(useAppStore.getState()).filter(f => f.outputTarget?.individualName === 'BG')
    expect(files).toHaveLength(1)
    expect(files[0].outputTarget?.processSuffixes).toEqual([])
    useAppStore.getState().setIndividualOutputEnabled('BG', false)
    expect(selectOutputFiles(useAppStore.getState()).some(f => f.outputTarget?.individualName === 'BG')).toBe(false)
  })

  it('retains hidden candidates and uses an explicit material choice over the legacy global default', () => {
    const { individual } = fixture()
    useAppStore.getState().setExcludeAutoMarked(true)
    expect(selectOutputFiles(useAppStore.getState()).some(f => f.sourceLayerId === individual[0].id)).toBe(false)
    useAppStore.getState().setIndividualOutputEnabled('撮影指示', true)
    expect(selectOutputFiles(useAppStore.getState()).some(f => f.sourceLayerId === individual[0].id)).toBe(true)
    useAppStore.getState().toggleLayerVisibility(individual[0].id)
    expect(selectOutputCandidates(useAppStore.getState()).some(e => e.id === individual[0].id)).toBe(true)
    expect(selectOutputFiles(useAppStore.getState()).some(f => f.sourceLayerId === individual[0].id)).toBe(false)
  })

  it('keeps an empty-suffix revision separate from the body', () => {
    fixture()
    useAppStore.getState().updateProcessTable([{ displayName: '修正', suffix: '', folderNames: ['作監', '演出'] }])
    useAppStore.getState().setExcludeBody(true)
    const before = selectOutputFiles(useAppStore.getState())
    expect(before.some(f => f.outputTarget?.processSuffixes.includes(''))).toBe(true)
    useAppStore.getState().toggleProcessSuffixExclusion('')
    const state = useAppStore.getState()
    expect(selectOutputFiles(state).some(f => f.outputTarget?.processSuffixes.includes(''))).toBe(false)
    expect(selectOutputNavigation(state).entries.map(e => e.id).sort()).toEqual(selectOutputFiles(state).map(f => f.sourceLayerId).sort())
  })

  it('makes automatic display optional and records name exclusions without banning output', () => {
    const source = makeFolder('_SL', [makeLayer({ name: 'hidden-content', hidden: true })])
    source.hidden = true
    const tree = buildLayerTree(makePsd({ children: [source, makeFolder('_old_01', [makeLayer()])] }), undefined, ['_old'])
    const sl = tree.find(l => l.originalName === '_SL')!
    expect(buildDefaultVisibilityOverrides(tree).get(sl.id)).toBe(false)
    expect(buildDefaultVisibilityOverrides(tree, null, false, false).has(sl.id)).toBe(false)
    expect(buildDefaultVisibilityOverrides(tree).has(sl.children[0].id)).toBe(false)
    const old = tree.find(l => l.originalName === '_old_01')!
    expect(old.individualOutputExcludedBy).toBe('_old')
    expect(old.autoMarked).toBe(false)
    resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100 })
    useAppStore.getState().toggleSingleMark(old.id)
    expect(selectOutputFiles(useAppStore.getState()).some(f => f.sourceLayerId === old.id)).toBe(true)
  })
})
