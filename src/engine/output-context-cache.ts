import type { OutputRenderCache, ContextFactory, OutputContext } from './cell-extractor'
import { releaseCanvas, withCanvasResources } from './render-resources'

function contextCanvases(cache: OutputRenderCache): Set<HTMLCanvasElement> {
  return new Set([...cache.values()].flatMap(value => [
    ...value.lower, ...value.upper, ...(value.material?.flatMap(m => [...m.lower, ...m.upper]) ?? []),
  ]).map(layer => layer.canvas))
}

/** LRU of immutable flattened contexts. Borrowed document pixels are never owned. */
export class OutputContextCache extends Map<ContextFactory, OutputContext> {
  private owned = new Set<HTMLCanvasElement>()
  private budget: number
  private maxEntries: number
  constructor(budget = 24 * 1024 * 1024, maxEntries = 8) { super(); this.budget = budget; this.maxEntries = maxEntries }
  override get(key: ContextFactory): OutputContext | undefined {
    const value = super.get(key)
    if (value) { super.delete(key); super.set(key, value) }
    return value
  }
  get bytes(): number { return [...this.owned].reduce((n, c) => n + c.width * c.height * 4, 0) }
  /** Called after compositing: no in-flight reader can still need an evicted context. */
  finish(allocated: ReadonlySet<HTMLCanvasElement>): void {
    let retained = contextCanvases(this)
    for (const canvas of allocated) if (retained.has(canvas)) this.owned.add(canvas)
    const bytes = () => [...retained].reduce((n, c) => n + (this.owned.has(c) ? c.width * c.height * 4 : 0), 0)
    while (this.size && (this.size > this.maxEntries || bytes() > this.budget)) {
      super.delete(this.keys().next().value!)
      retained = contextCanvases(this)
    }
    for (const canvas of this.owned) if (!retained.has(canvas)) { releaseCanvas(canvas); this.owned.delete(canvas) }
  }
  override clear(): void {
    for (const canvas of this.owned) releaseCanvas(canvas)
    this.owned.clear(); super.clear()
  }
}

export function renderWithContextCache<T>(cache: OutputRenderCache | undefined,
  render: (cache: OutputRenderCache) => T, canvasOf: (result: T) => HTMLCanvasElement): T {
  const contexts = cache ?? new Map()
  return withCanvasResources(() => {
    try { return render(contexts) }
    catch (error) { contexts.clear(); throw error }
  }, (result, allocated) => {
    if (contexts instanceof OutputContextCache) contexts.finish(allocated)
    return [canvasOf(result), ...(cache ? contextCanvases(contexts) : [])]
  })
}
