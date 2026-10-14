import { afterEach, describe, expect, it } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { useAppStore } from '../../store'
import { selectOutputFiles } from '../../store/selectors'
import { renderOutputFile } from '../../utils/output-render-queue'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

afterEach(resetTestStore)
describe('render provenance', () => {
  it('includes the actual cel/process, pass-through wrappers and context, while excluding other outputs and hidden content', () => {
    const tree = buildLayerTree(makePsd({ children: [makeLayer({ name: 'paper' }), makeFolder('_separate', [makeLayer()]),
      makeAnimationFolder('A', [makeFolder('1', [makeLayer({ name: 'body' }), makeFolder('_s', [makeLayer({ name: 'ink' }), makeLayer({ name: 'hidden', hidden: true })])]), makeLayer({ name: '2' })])] }))
    const anim = tree[0]; anim.isAnimationFolder = true; anim.animationFolder = { detectedBy: 'manual', trackName: 'A' }
    resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100 })
    const cell = anim.children.find(cell => cell.originalName === '1')!, process = cell.children.find(layer => layer.originalName === '_s')!
    const plan = selectOutputFiles(useAppStore.getState()).find(file => file.sourceLayerId === process.id)!
    const rendered = renderOutputFile(plan, useAppStore.getState().projectSettings.processTable, true)
    const names = new Map<string, string>()
    const index = (nodes: typeof tree) => nodes.forEach(node => { names.set(node.id, node.originalName); index(node.children) })
    index(tree)
    expect([...rendered.sources.all].map(id => names.get(id))).toEqual(expect.arrayContaining(['A', '1', '_s', 'ink', 'paper']))
    expect([...rendered.sources.all].map(id => names.get(id))).not.toEqual(expect.arrayContaining(['hidden']))
    for (const name of ['body', '2', '_separate', 'hidden']) expect([...rendered.sources.all].map(id => names.get(id))).not.toContain(name)
    expect(rendered.sources.content.has(process.id)).toBe(true)
    expect(rendered.sources.content.has(tree.at(-1)!.id)).toBe(false)
  })
  it('traces a virtual-cell visibility override without changing the original eye', () => {
    const tree = buildLayerTree(makePsd({ children: [makeLayer({ name: 'paper' }), makeFolder('_asset', [makeLayer({ name: 'ink' })])] }))
    const asset = tree[0]
    const originalOpacity = asset.opacity
    resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100, visibilityOverrides: new Map([[asset.id, true]]),
      virtualSets: [{ id: 'vs', name: 'vs', insertionLayerId: tree[1].id, insertionPosition: 'above', expandToAnimationCells: false,
        members: [{ layerId: asset.id, opacity: 35, blendMode: null }], visibilityOverrides: { [asset.id]: true } }] })
    const state = useAppStore.getState(), plan = selectOutputFiles(state).find(file => file.sourceLayerId === 'vs')!
    const rendered = renderOutputFile(plan, state.projectSettings.processTable, false)
    expect(rendered.sources.content.has(asset.children[0].id)).toBe(true)
    expect(useAppStore.getState().visibilityOverrides.get(asset.id)).toBe(true)
    expect(asset.opacity).toBe(originalOpacity)
  })
})
