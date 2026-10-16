import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { useAppStore } from '../../store'
import { selectDraftOutputs, selectOutputFiles } from '../../store/selectors'
import { buildLayerTree } from '../../engine/tree-builder'
import { OutputRenderQueue, renderOutputFile } from '../../utils/output-render-queue'
import { DEFAULT_PROJECT_SETTINGS } from '../../types'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

beforeEach(() => {
  resetTestStore()
  vi.useFakeTimers()
  const original = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) =>
    tag === 'canvas' ? createCanvas(1, 1) as unknown as HTMLCanvasElement : original(tag, options))
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); resetTestStore() })

function fixture() {
  function art(name: string, color: string) {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 120
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = color; ctx.fillRect(20, 40, 80, 40)
    return makeLayer({ name, canvas, width: 160, height: 120, opacity: 1 })
  }
  const tree = buildLayerTree(makePsd({ width: 160, height: 120, children: [
    makeAnimationFolder('A', [makeFolder('1', [art('body', '#2178bb'), makeFolder('EN', [art('ink', '#b43815')])])]),
  ] }))
  const anim = tree[0], cell = anim.children[0], body = cell.children.find(l => l.originalName === 'body')!
  anim.isAnimationFolder = true; anim.animationFolder = { detectedBy: 'manual', trackName: 'A' }
  useAppStore.setState({ layerTree: tree, docWidth: 160, docHeight: 120,
    visibilityOverrides: new Map([[body.id, false]]),
    projectSettings: { ...DEFAULT_PROJECT_SETTINGS, cellNamingMode: 'sequence',
      processTable: [{ suffix: '_e', folderNames: ['EN'], revisionBorderColor: '#ff0000' }] },
    virtualSets: ['placed', 'draft'].map(id => ({ id, name: id, insertionLayerId: id === 'placed' ? anim.id : null,
      insertionPosition: 'above', members: [{ layerId: body.id, opacity: null, blendMode: null }],
      expandToAnimationCells: false, visibilityOverrides: {} })),
  })
  return { anim, cell, body }
}
const files = () => [...selectOutputFiles(useAppStore.getState()), ...selectDraftOutputs(useAppStore.getState())]
const pixels = (canvas: HTMLCanvasElement) => canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data

async function renderAndCompare(queue: OutputRenderQueue) {
  const state = useAppStore.getState(), plans = files()
  const release = plans.map(file => queue.request(file, 'full', () => renderOutputFile(file, state.projectSettings.processTable, state.outputConfig.revisionBorderEnabled)))
  await vi.runAllTimersAsync()
  for (const file of plans) {
    const cached = queue.get(file, 'full')!.image!
    const fresh = renderOutputFile(file, state.projectSettings.processTable, state.outputConfig.revisionBorderEnabled)
    expect(Buffer.from(pixels(cached.canvas)).equals(Buffer.from(pixels(fresh.canvas))), file.relativePath).toBe(true)
    expect(cached.sources).toEqual(fresh.sources)
    expect(cached.vectorWarning).toBe(fresh.vectorWarning)
    expect(cached.unsupported3D).toBe(fresh.unsupported3D)
  }
  release.forEach(fn => fn())
  return plans
}

describe('image cache independent of export metadata', () => {
  it('reuses pixels and provenance across naming, encoding, filtering and virtual-cell renames', async () => {
    fixture()
    const queue = new OutputRenderQueue()
    const first = await renderAndCompare(queue), keys = new Map(first.map(f => [f.outputId, f.renderKey]))
    const initial = queue.getStats()
    const actions = [
      () => useAppStore.getState().setJpgQuality(0.75),
      () => useAppStore.getState().setStructure('hierarchy'),
      () => useAppStore.getState().setSequenceDigitMode('fixed-4'),
      () => useAppStore.getState().setProcessSuffixPosition('before-cell'),
      () => useAppStore.setState(s => ({ outputConfig: { ...s.outputConfig, format: 'png' } })),
      () => useAppStore.getState().setExcludeBody(true),
      () => useAppStore.getState().setExcludeBody(false),
      () => useAppStore.setState(s => ({ projectSettings: { ...s.projectSettings,
        processTable: s.projectSettings.processTable.map(entry => ({ ...entry, displayName: 'renamed process' })) } })),
      () => useAppStore.setState(s => ({ virtualSets: s.virtualSets.map(vs => ({ ...vs, name: 'renamed' })) })),
    ]
    for (const action of actions) {
      action()
      for (const file of await renderAndCompare(queue)) expect(file.renderKey).toBe(keys.get(file.outputId))
      expect(queue.getStats().renders).toBe(initial.renders)
      expect(queue.getStats().bytes).toBe(initial.bytes)
      expect(queue.getStats().entries).toBe(initial.entries)
    }
    expect(files()[0].relativePath).not.toBe(first[0].relativePath)
    expect(files().find(f => f.sourceLayerId === 'draft')!.fileName).toBe('renamed')
    queue.clear()
  })

  it('invalidates visual changes, including undo/redo, without ever serving stale pixels', async () => {
    const { body } = fixture(), queue = new OutputRenderQueue()
    useAppStore.setState(s => ({ outputConfig: { ...s.outputConfig, format: 'png' } }))
    await renderAndCompare(queue)
    const actions = [
      () => useAppStore.getState().setBackground('transparent'),
      () => useAppStore.getState().setLayerOpacity(body.id, 35),
      () => useAppStore.getState().undo(),
      () => useAppStore.getState().redo(),
      () => useAppStore.getState().setLayerBlendMode(body.id, 'multiply'),
      () => useAppStore.getState().toggleLayerVisibility(body.id),
      () => useAppStore.getState().toggleLayerVisibility(body.id),
      () => useAppStore.setState(s => ({ virtualSets: s.virtualSets.map(vs => ({ ...vs, members: vs.members.map(m => ({ ...m, opacity: 20 })) })) })),
      () => useAppStore.setState(s => ({ virtualSets: s.virtualSets.map(vs => ({ ...vs, insertionPosition: 'below' })) })),
      () => useAppStore.getState().updateProcessTable([{ suffix: '_e', folderNames: [] }]),
      () => useAppStore.setState(s => ({ docWidth: s.docWidth + 1 })),
      () => useAppStore.setState(s => ({ layerTree: [...s.layerTree] })), // new document/tree, even with identical layer IDs
    ]
    for (const [index, action] of actions.entries()) {
      const before = new Map(files().map(f => [f.outputId, f.renderKey]))
      action()
      const after = await renderAndCompare(queue)
      expect(after.some(f => f.renderKey !== before.get(f.outputId)), `visual change ${index}`).toBe(true)
    }
    queue.clear()
  })

  it('only invalidates the affected border color, and separates draft and placed context', async () => {
    const { anim } = fixture(), queue = new OutputRenderQueue()
    const first = await renderAndCompare(queue), initial = queue.getStats().renders
    useAppStore.getState().updateProcessTable([{ suffix: '_e', folderNames: ['EN'], revisionBorderColor: '#00ff00' }])
    const changed = await renderAndCompare(queue)
    expect(queue.getStats().renders - initial).toBe(1)
    expect(changed.filter((file, i) => file.renderKey !== first[i].renderKey)).toHaveLength(1)
    useAppStore.getState().setRevisionBorderEnabled(false)
    await renderAndCompare(queue)
    expect(queue.getStats().renders - initial).toBe(2)
    const draft = files().find(f => f.sourceLayerId === 'draft')!
    useAppStore.setState(s => ({ virtualSets: s.virtualSets.map(vs => vs.id === 'draft' ? { ...vs, insertionLayerId: anim.id } : vs) }))
    const placed = (await renderAndCompare(queue)).find(f => f.sourceLayerId === 'draft')!
    expect(placed.renderKey).not.toBe(draft.renderKey)
    queue.clear()
  })
})
