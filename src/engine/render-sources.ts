import type { FlatLayer } from '../types'

// Render provenance follows the actual compositor, including pruned contexts,
// masks and virtual-cell overrides. Weak keys never retain image buffers.
const sources = new WeakMap<HTMLCanvasElement, ReadonlySet<string>>()
const content = new WeakMap<HTMLCanvasElement, ReadonlySet<string>>()
const empty: ReadonlySet<string> = new Set()

export function canvasSources(canvas: HTMLCanvasElement): ReadonlySet<string> {
  return sources.get(canvas) ?? empty
}

export function flatSources(flats: readonly FlatLayer[]): Set<string> {
  return new Set(flats.flatMap(flat => [flat.sourceId, ...(flat.contributionIds ?? []), ...canvasSources(flat.canvas)]))
}

export function recordComposite(canvas: HTMLCanvasElement, flats: readonly FlatLayer[]): HTMLCanvasElement {
  sources.set(canvas, flatSources(flats))
  return canvas
}

export function copyRenderSources(result: HTMLCanvasElement, source: HTMLCanvasElement): HTMLCanvasElement {
  sources.set(result, canvasSources(source))
  return result
}

export function recordOutputSources(canvas: HTMLCanvasElement, flats: readonly FlatLayer[], containers: string[] = []): HTMLCanvasElement {
  const primary = flatSources(flats)
  content.set(canvas, new Set([...primary, ...containers]))
  sources.set(canvas, new Set([...canvasSources(canvas), ...containers]))
  return canvas
}

export function outputSources(canvas: HTMLCanvasElement) {
  return { all: canvasSources(canvas), content: content.get(canvas) ?? canvasSources(canvas) }
}

export function includeContainer(flats: FlatLayer[], id: string): FlatLayer[] {
  return flats.map(flat => ({ ...flat, contributionIds: [...(flat.contributionIds ?? []), id] }))
}
