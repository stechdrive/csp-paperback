import type { OutputRenderCache, ContextFactory, OutputContext } from './cell-extractor'
import { canvasBounds, createRenderCanvas, detachCanvasResource, releaseCanvas, setCanvasBounds, withCanvasResources } from './render-resources'
import { copyRenderSources } from './render-sources'
import { copyRenderWarnings } from './render-warning'
import { withMaterialEffectCache } from './material-effect-cache'
import type { FlatLayer } from '../types'

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
  private singleImageBudget: number
  private effects = new Map<string, HTMLCanvasElement>()
  private effectHits = 0
  constructor(budget = 24 * 1024 * 1024, maxEntries = 8, singleImageBudget = budget) {
    super(); this.budget = budget; this.maxEntries = maxEntries; this.singleImageBudget = singleImageBudget
  }
  getEffect(key: string): HTMLCanvasElement | undefined {
    const result = this.effects.get(key)
    if (result) { this.effects.delete(key); this.effects.set(key, result); this.effectHits++ }
    return result
  }
  setEffect(key: string, canvas: HTMLCanvasElement): void {
    detachCanvasResource(canvas)
    this.owned.add(canvas)
    this.effects.set(key, canvas)
  }
  get effectStats() { return { entries: this.effects.size, hits: this.effectHits } }
  override get(key: ContextFactory): OutputContext | undefined {
    const value = super.get(key)
    if (value) { super.delete(key); super.set(key, value) }
    return value
  }
  get bytes(): number { return [...this.owned].reduce((n, c) => n + c.width * c.height * 4, 0) }
  /** Called after compositing: no in-flight reader can still need an evicted context. */
  finish(allocated: ReadonlySet<HTMLCanvasElement>): void {
    // Crop already rasterized contexts at integer coordinates. Source canvases and
    // fractional placement stay untouched; masks/effects have already been applied.
    const cropped = new Map<HTMLCanvasElement, { canvas: HTMLCanvasElement; left: number; top: number }>()
    const compact = (flat: FlatLayer): FlatLayer => {
      if ((!allocated.has(flat.canvas) && !this.owned.has(flat.canvas)) ||
        !Number.isInteger(flat.left) || !Number.isInteger(flat.top)) return flat
      let replacement = cropped.get(flat.canvas)
      if (!replacement) {
        const area = canvasBounds(flat.canvas, 0, 0, flat.canvas.width, flat.canvas.height)
        if (!area.width || !area.height || area.width * area.height >= flat.canvas.width * flat.canvas.height) return flat
        const canvas = createRenderCanvas(area.width, area.height)
        canvas.getContext('2d')!.drawImage(flat.canvas, -area.left, -area.top)
        copyRenderSources(canvas, flat.canvas); copyRenderWarnings(canvas, flat.canvas)
        setCanvasBounds(canvas, { left: 0, top: 0, width: area.width, height: area.height })
        replacement = { canvas, left: area.left, top: area.top }
        cropped.set(flat.canvas, replacement)
      }
      return { ...flat, canvas: replacement.canvas, left: flat.left + replacement.left, top: flat.top + replacement.top }
    }
    for (const value of this.values()) {
      value.lower = value.lower.map(compact); value.upper = value.upper.map(compact)
      for (const material of value.material ?? []) {
        material.lower = material.lower.map(compact); material.upper = material.upper.map(compact)
      }
    }
    const retainedCanvases = () => new Set([...contextCanvases(this), ...this.effects.values()])
    let retained = retainedCanvases()
    for (const canvas of allocated) if (retained.has(canvas)) this.owned.add(canvas)
    const bytes = () => [...retained].reduce((n, c) => n + (this.owned.has(c) ? c.width * c.height * 4 : 0), 0)
    const overBudget = () => bytes() > this.budget && !(bytes() <= this.singleImageBudget && [...retained].filter(c => this.owned.has(c)).length === 1)
    while (this.size + this.effects.size && (this.size > this.maxEntries || this.effects.size > 64 || overBudget())) {
      if (this.size > this.maxEntries || !this.effects.size) super.delete(this.keys().next().value!)
      else this.effects.delete(this.effects.keys().next().value!)
      retained = retainedCanvases()
    }
    for (const canvas of this.owned) if (!retained.has(canvas)) { releaseCanvas(canvas); this.owned.delete(canvas) }
  }
  override clear(): void {
    for (const canvas of this.owned) releaseCanvas(canvas)
    this.owned.clear(); this.effects.clear(); super.clear()
  }
}

export function renderWithContextCache<T>(cache: OutputRenderCache | undefined,
  render: (cache: OutputRenderCache) => T, canvasOf: (result: T) => HTMLCanvasElement): T {
  const contexts = cache ?? new Map()
  return withCanvasResources(() => {
    try { return withMaterialEffectCache(contexts instanceof OutputContextCache ? contexts : undefined, () => render(contexts)) }
    catch (error) { contexts.clear(); throw error }
  }, (result, allocated) => {
    try { if (contexts instanceof OutputContextCache) contexts.finish(allocated) }
    catch (error) { contexts.clear(); throw error }
    return [canvasOf(result), ...(cache ? contextCanvases(contexts) : [])]
  })
}
