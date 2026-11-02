import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../store'
import { selectLayerTreeWithVisibility, selectOutputCandidates, selectOutputFiles, selectOutputNavigation } from '../../store/selectors'
import { buildOutputEntriesFromState, planExportEntriesFromState } from '../../utils/export-entries'
import { isSharedCutMode, timelineOutputPolicy } from '../../utils/timeline-output'
import type { ClipDocument, ClipLayer, ClipTimeline } from '../../utils/clip/types'
import type { VirtualSet } from '../../types'
import { resetTestStore } from '../helpers/store-reset'

function cel(id: string, name = id, hidden = false): ClipLayer {
  return { id, name, hidden, isFolder: false, isAnimationFolder: false, expanded: true,
    opacity: 1, blendMode: 'normal', clipping: false, children: [],
    pixels: { width: 1, height: 1, left: 0, top: 0, rgba: new Uint8ClampedArray([80, 120, 160, 255]) } }
}
function folder(id: string, children: ClipLayer[], animation = true, hidden = false): ClipLayer {
  return { ...cel(id, id, hidden), pixels: undefined, isFolder: true, isAnimationFolder: animation, children }
}
function timeline(id: number, names: string[], folderId = 'A'): ClipTimeline {
  return { id, bindings: { [folderId]: id * 100 }, diagnostics: [], data: {
    duration: 24, fps: 24, version: 10, header: { cut: '', scene: '' }, timeTableName: `cut ${id}`,
    tracks: [{ name: 'A', trackNo: id * 100, cellNames: names,
      frames: names.map((cellName, index) => ({ frameIndex: index * 3, cellName })) }],
  } }
}
function document(timelines = [timeline(1, ['1']), timeline(2, ['2'])], layers = [folder('A', ['3', '2', '1'].map(id => cel(id)))]): ClipDocument {
  return { width: 2, height: 2, dpi: 72, diagnostics: [], defaultTimelineId: timelines[0]?.id ?? null, layers, timelines }
}
function load(clip = document()) { useAppStore.getState().loadClip(clip, 'synthetic.clip') }
const files = () => selectOutputFiles(useAppStore.getState())
const ids = () => files().map(file => file.sourceCellId)
const names = () => files().map(file => [file.sourceCellId, file.flatName])

beforeEach(() => resetTestStore())
afterEach(() => resetTestStore())

describe('native timeline output eligibility', () => {
  it.each([false, true])('single timeline ignores shared preference=%s; eyes cannot re-enable unused export', sharedCutMode => {
    useAppStore.getState().setSharedCutMode(sharedCutMode)
    load(document([timeline(1, ['1'])]))
    expect(useAppStore.getState().projectSettings.sharedCutMode).toBe(sharedCutMode)
    expect(isSharedCutMode(useAppStore.getState())).toBe(false)
    expect(ids()).toEqual(['clip:1'])
    useAppStore.getState().toggleLayerVisibility('clip:3')
    const state = useAppStore.getState()
    expect(selectLayerTreeWithVisibility(state)[0].children[0].uiHidden).toBe(false)
    expect(ids()).toEqual(['clip:1'])
    expect(selectOutputNavigation(state).entries.map(entry => entry.id)).toEqual(['clip:1'])
    expect(selectOutputCandidates(state).map(entry => entry.id)).toEqual(['clip:1'])
    expect(planExportEntriesFromState(state).map(entry => entry.sourceCellId)).toEqual(['clip:1'])
    expect(planExportEntriesFromState(state, { ...state.outputConfig }).map(entry => entry.sourceCellId)).toEqual(['clip:1'])
    expect(planExportEntriesFromState(state, state.outputConfig, new Set(['cell:clip:A:clip:3']))).toEqual([])
    expect(buildOutputEntriesFromState(state).map(entry => entry.sourceCellId)).toEqual(['clip:1'])
    state.resetVisibility()
    expect(ids()).toEqual(['clip:1'])
  })

  it('shared output uses the union; switching playback or manually showing never-used cels does not change it', () => {
    load()
    expect(isSharedCutMode(useAppStore.getState())).toBe(true)
    expect(ids()).toEqual(['clip:2', 'clip:1'])
    const before = names()
    useAppStore.getState().selectClipTimeline(2)
    expect(names()).toEqual(before)
    useAppStore.getState().seekToFrame(12)
    expect(names()).toEqual(before)
    useAppStore.getState().toggleLayerVisibility('clip:3')
    useAppStore.getState().toggleLayerVisibility('clip:3')
    expect(ids()).toEqual(['clip:2', 'clip:1'])
    useAppStore.getState().setSharedCutMode(false)
    expect(ids()).toEqual(['clip:2'])
    useAppStore.getState().selectClipTimeline(1)
    expect(ids()).toEqual(['clip:1'])
  })

  it('shared folder rescue retains saved child visibility, and never activates for a single timeline', () => {
    const layers = [folder('A', [cel('2', '2', true), cel('1')], true, true)]
    useAppStore.getState().setSharedCutMode(true)
    load(document([timeline(1, ['1'])], layers))
    expect(ids()).toEqual([])
    load(document(undefined, layers))
    expect(ids()).toEqual(['clip:1'])
    useAppStore.getState().toggleLayerVisibility('clip:2')
    expect(ids()).toEqual(['clip:2', 'clip:1'])
  })

  it('retains folder UUID bindings and resolves duplicate cel names bottom-first', () => {
    const a = { ...folder('first', [cel('top', '1'), cel('bottom', '1')]), name: 'A' }
    const b = { ...folder('second', [cel('other', '1'), cel('unused', '2')]), name: 'A' }
    load(document([timeline(1, ['1'], 'first'), timeline(2, ['1'], 'second')], [a, b]))
    expect(ids()).toEqual(['clip:bottom', 'clip:other'])
    const before = names()
    useAppStore.getState().selectClipTimeline(2)
    expect(names()).toEqual(before)
  })

  it.each(['empty', 'unbound'] as const)('excludes cels in a successfully parsed %s track', kind => {
    const t = timeline(1, [])
    if (kind === 'unbound') { t.bindings = {}; t.data.tracks = [] }
    load(document([t]))
    expect(files()).toEqual([])
    expect(selectOutputCandidates(useAppStore.getState())).toEqual([])
  })

  it('documents without a timeline retain their untimed outputs', () => {
    load(document([]))
    expect(ids()).toEqual(['clip:3', 'clip:2', 'clip:1'])
  })

  it.each([undefined, 'A'])('does not treat an unreadable timeline as unused (diagnostic layer %s)', layerId => {
    const bad = timeline(2, [])
    bad.bindings = {}; bad.data.tracks = []
    bad.diagnostics = [{ scope: 'timeline', code: 'UNSUPPORTED_ANIMATION', message: 'Unsupported test track', layerId }]
    load(document([timeline(1, ['1']), bad]))
    expect(ids()).toEqual(['clip:3', 'clip:2', 'clip:1'])
    expect(useAppStore.getState().clipDiagnostics.map(d => d.code)).toContain('UNSUPPORTED_ANIMATION')
    useAppStore.getState().setSharedCutMode(false)
    expect(ids()).toEqual(['clip:1'])
    expect(useAppStore.getState().clipDiagnostics).toEqual([])
    useAppStore.getState().undo()
    expect(ids()).toHaveLength(3)
    expect(useAppStore.getState().clipDiagnostics.map(d => d.code)).toContain('UNSUPPORTED_ANIMATION')
    useAppStore.getState().redo()
    expect(ids()).toEqual(['clip:1'])
    expect(useAppStore.getState().clipDiagnostics).toEqual([])
    useAppStore.getState().importSettings(JSON.stringify({ ...useAppStore.getState().projectSettings, sharedCutMode: true }))
    expect(ids()).toHaveLength(3)
    expect(useAppStore.getState().clipDiagnostics.map(d => d.code)).toContain('UNSUPPORTED_ANIMATION')
  })

  it('a missing parsed track is unknown, while an unrelated folder error does not disable filtering', () => {
    const t = timeline(1, ['1'])
    t.data.tracks = []
    load(document([t]))
    expect(timelineOutputPolicy(useAppStore.getState()).excludedCellIds.size).toBe(0)
    const good = timeline(1, ['1'])
    good.diagnostics = [{ scope: 'timeline', layerId: 'other', message: 'Other folder' }]
    load(document([good]))
    expect(ids()).toEqual(['clip:1'])
  })

  it('keeps saved out-of-playback assignments and carried-in assignments', () => {
    const t = timeline(1, ['1', '2'])
    t.data.tracks[0].frames = [{ frameIndex: -2.5, cellName: '1' }, { frameIndex: 2, cellName: null },
      { frameIndex: 30, cellName: '2' }, { frameIndex: 35, cellName: null }]
    load(document([t]))
    expect(ids()).toEqual(['clip:2', 'clip:1'])
  })

  it('process entries inherit usage from their owning cel, while virtual material references remain available', () => {
    useAppStore.setState(s => ({ projectSettings: { ...s.projectSettings, processTable: [{ suffix: '_e', folderNames: ['EN'] }] } }))
    const cell = (id: string) => folder(id, [cel(`ink-${id}`), { ...folder(`en-${id}`, [cel(`revision-${id}`)], false), name: 'EN' }], false)
    load(document([timeline(1, ['1']), timeline(2, ['1'])], [folder('A', [cell('2'), cell('1')])]))
    expect(files().map(file => file.sourceLayerId)).toEqual(['clip:1', 'clip:en-1'])
    const virtual: VirtualSet = { id: 'virtual', name: 'reuse', insertionLayerId: 'clip:A', insertionPosition: 'above',
      members: [{ layerId: 'clip:ink-2', opacity: null, blendMode: null }], expandToAnimationCells: false, visibilityOverrides: {} }
    useAppStore.setState({ virtualSets: [virtual] })
    expect(files().map(file => file.sourceLayerId)).toEqual(['clip:1', 'clip:en-1', 'virtual'])
    expect(selectLayerTreeWithVisibility(useAppStore.getState())[0].children[0].id).toBe('clip:2')
    expect(selectOutputNavigation(useAppStore.getState()).entries.map(entry => entry.id).sort())
      .toEqual(['clip:1', 'clip:en-1', 'virtual'].sort())
  })

  it('changes all cached enumerations when native timeline metadata changes', () => {
    load()
    const state = useAppStore.getState()
    const before = selectOutputFiles(state)
    selectOutputNavigation(state); selectOutputCandidates(state)
    useAppStore.setState({ clipDocument: { ...state.clipDocument!, timelines: [timeline(1, ['1']), timeline(2, ['3'])] } })
    expect(files()).not.toBe(before)
    expect(ids()).toEqual(['clip:3', 'clip:1'])
    expect(selectOutputNavigation(useAppStore.getState()).entries.map(entry => entry.id)).toEqual(['clip:3', 'clip:1'])
    expect(selectOutputCandidates(useAppStore.getState()).map(entry => entry.id)).toEqual(['clip:3', 'clip:1'])
  })
})

describe('stable shared-cut numbering', () => {
  it('uses native file order despite the saved/selected timeline, keeps earlier numbers and appends new cels', () => {
    useAppStore.getState().setCellNamingMode('sheet-sequence')
    const clip = document([timeline(1, ['1', '2']), timeline(2, ['2', '1', '3'])], [folder('A', ['4', '3', '2', '1'].map(id => cel(id)))])
    clip.defaultTimelineId = 2
    load(clip)
    const expected = [['clip:3', 'A_3.jpg'], ['clip:2', 'A_2.jpg'], ['clip:1', 'A_1.jpg']]
    expect(names()).toEqual(expected)
    useAppStore.getState().selectClipTimeline(1)
    expect(names()).toEqual(expected)
    useAppStore.getState().setOutputAlias('clip:A', 'Z')
    expect(files().map(file => file.flatName)).toEqual(['Z_3.jpg', 'Z_2.jpg', 'Z_1.jpg'])
  })

  it('numbers only eligible cels, including automatic digit width', () => {
    useAppStore.getState().setCellNamingMode('sequence')
    load(document([timeline(1, ['1']), timeline(2, ['3'])], [folder('A', Array.from({ length: 10 }, (_, i) => cel(String(10 - i))))]))
    expect(names()).toEqual([['clip:3', 'A_2.jpg'], ['clip:1', 'A_1.jpg']])
  })
})
