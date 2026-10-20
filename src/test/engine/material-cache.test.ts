import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { flattenToCanvas } from '../../engine/flatten'
import { collectRenderMaterials } from '../../engine/material-dependencies'
import { registerMaterial, withPreparedMaterials, materialInfo, materialStats, MaterialResourceError } from '../../engine/material-cache'
import { renderIssues } from '../../utils/render-diagnostics'
import type { CspLayer } from '../../types'
import type { Layer } from 'ag-psd'

const disposers: (() => void)[] = []
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()) })
function deferred(name: string, size = 4) {
  const ref: Layer = { name, opacity: 1, left: 0, top: 0, right: size, bottom: size }
  const load = vi.fn(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = size; canvas.height = size
    ref.canvas = canvas
    return { diagnostics: [] }
  })
  disposers.push(registerMaterial(ref, size * size * 4, load))
  const layer = buildLayerTree({ width: size, height: size, children: [ref] })[0]
  return { ref, layer, load }
}

describe('reloadable material residency', () => {
  it('processes more than 512 MiB cumulatively, evicts and reloads', async () => {
    // The mocked canvas has no backing pixels; exercise byte accounting without
    // consuming hundreds of MiB in the test runner.
    const sources = Array.from({ length: 16 }, (_, i) => deferred(`cel ${i}`, 3072))
    let cumulative = 0
    for (const source of sources) {
      await withPreparedMaterials([source.layer], () => {
        cumulative += source.ref.canvas!.width * source.ref.canvas!.height * 4
        expect(source.ref.canvas!.width).toBe(3072)
      })
      expect(materialStats().bytes).toBeLessThanOrEqual(materialStats().budget)
    }
    expect(cumulative).toBeGreaterThan(512 * 1024 * 1024)
    expect(materialInfo(sources[0].ref)?.state).toBe('evicted')
    await withPreparedMaterials([sources[0].layer], () => expect(sources[0].ref.canvas!.width).toBe(3072))
    expect(sources[0].load).toHaveBeenCalledTimes(2)
  })

  it('does not decode hidden layers or a different selected cel during dependency traversal', async () => {
    const one = deferred('1'), two = deferred('2'), hidden = deferred('hidden')
    const animation: CspLayer = { ...one.layer, id: 'animation', isFolder: true, isAnimationFolder: true,
      agPsdRef: { name: 'animation' }, children: [one.layer, two.layer] }
    hidden.layer.hidden = true
    const tree = [animation, hidden.layer]
    const draw = () => flattenToCanvas(tree, 4, 4, 'transparent', new Map([['animation', 1]]))
    const dependencies = collectRenderMaterials(draw)
    expect(one.load).not.toHaveBeenCalled()
    expect(dependencies.map(layer => layer.id)).toContain(two.layer.id)
    expect(dependencies.map(layer => layer.id)).not.toContain(one.layer.id)
    await withPreparedMaterials(dependencies, draw)
    expect(two.load).toHaveBeenCalledOnce()
    expect(one.load).not.toHaveBeenCalled()
    expect(hidden.load).not.toHaveBeenCalled()
  })

  it('fails a working set before allocation, and retries a transient decode failure', async () => {
    const ref: Layer = { name: 'too large' }
    const load = vi.fn(async () => ({ diagnostics: [] }))
    disposers.push(registerMaterial(ref, 800 * 1024 * 1024, load))
    const layer = buildLayerTree({ width: 4, height: 4, children: [ref] })[0]
    const draw = vi.fn()
    await expect(withPreparedMaterials([layer], draw)).rejects.toBeInstanceOf(MaterialResourceError)
    expect(load).not.toHaveBeenCalled()
    expect(draw).not.toHaveBeenCalled()
    const source = deferred('retry')
    source.load.mockRejectedValueOnce(new Error('temporary failure'))
    await expect(withPreparedMaterials([source.layer], draw)).rejects.toThrow('temporary failure')
    expect(materialInfo(source.ref)?.state).toBe('failed')
    expect(renderIssues([source.layer])).toMatchObject([{ message: 'temporary failure（再試行可能）', outcome: undefined }])
    await withPreparedMaterials([source.layer], draw)
    expect(draw).toHaveBeenCalledOnce()
  })

  it('keeps failures on the exact layer and includes a missing raster in output provenance', async () => {
    const ref: Layer = { name: 'missing raster' }
    disposers.push(registerMaterial(ref, 0, async () => ({ diagnostics: [{
      scope: 'raster', layerId: 'native', part: 'material', outcome: 'missing-content', message: 'タイルが壊れています',
    }] })))
    const tree = buildLayerTree({ width: 4, height: 4, children: [{ name: 'parent', children: [ref] }] })
    const leaf = tree[0].children[0]
    await withPreparedMaterials([leaf], () => flattenToCanvas(tree, 4, 4))
    expect(renderIssues([leaf])).toMatchObject([{ layerId: leaf.id, message: 'タイルが壊れています' }])
    expect(renderIssues([tree[0]])).toEqual([])
    const { canvasSources } = await import('../../engine/render-sources')
    const canvas = await withPreparedMaterials([leaf], () => flattenToCanvas(tree, 4, 4))
    expect(canvasSources(canvas)).toContain(leaf.id)
  })

  it('does not publish material pixels when the document is disposed during decoding', async () => {
    const source = deferred('old')
    let finish!: () => void
    source.load.mockImplementationOnce(async () => { await new Promise<void>(resolve => { finish = resolve }); return { diagnostics: [] } })
    const draw = vi.fn()
    const result = withPreparedMaterials([source.layer], draw)
    await vi.waitFor(() => expect(source.load).toHaveBeenCalledOnce())
    disposers.splice(0).forEach(dispose => dispose())
    finish()
    await expect(result).rejects.toThrow('切り替わった')
    expect(draw).not.toHaveBeenCalled()
  })

  it('cancels a queued frame before decoding its sources', async () => {
    const first = deferred('first'), obsolete = deferred('obsolete')
    let finish!: () => void
    first.load.mockImplementationOnce(async () => { await new Promise<void>(resolve => { finish = resolve }); return { diagnostics: [] } })
    const running = withPreparedMaterials([first.layer], () => undefined)
    await vi.waitFor(() => expect(first.load).toHaveBeenCalledOnce())
    const draw = vi.fn()
    const skipped = withPreparedMaterials([obsolete.layer], draw, () => true)
    finish()
    await running
    await expect(skipped).rejects.toThrow('変更された')
    expect(obsolete.load).not.toHaveBeenCalled()
    expect(draw).not.toHaveBeenCalled()
  })
})
