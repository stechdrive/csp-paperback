import type { OutputFile } from './output-plan'
import type { ProjectSettings } from '../types'
import { applyRevisionBorders } from './revision-border'
import { outputSources } from '../engine/render-sources'
import { hasVectorWarning, hasUnsupported3D } from '../engine/render-warning'
import { OutputContextCache, renderWithContextCache } from '../engine/output-context-cache'
import type { OutputRenderCache } from '../engine/cell-extractor'
import { collectRenderMaterials } from '../engine/material-dependencies'
import { withPreparedMaterials } from '../engine/material-cache'
import { renderIssues, type RenderIssue } from './render-diagnostics'
import type { ClipDiagnostic } from './clip/types'

export interface RenderedOutput {
  canvas: HTMLCanvasElement
  sources: ReturnType<typeof outputSources>
  vectorWarning: boolean
  unsupported3D: boolean
  diagnostics?: RenderIssue[]
}
export type RenderSize = 'full' | 'comparison' | 'thumbnail' | 'check'
export type RenderResult = { image?: RenderedOutput; error?: string }
type Draw = (cache: OutputRenderCache, cancelled: () => boolean) => RenderedOutput | Promise<RenderedOutput>
type Job = { key: string; size: RenderSize; draw: Draw; users: number }
const priority = { full: 0, comparison: 1, thumbnail: 2, check: 3 }
const cost = (result?: RenderResult) => result?.image ? result.image.canvas.width * result.image.canvas.height * 4 : 0

/** Only visible consumers pin pixels. Notifications are scoped to each file/resolution. */
export class OutputRenderQueue {
  private jobs: Job[] = []
  private cache = new Map<string, Partial<Record<RenderSize, RenderResult>>>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private listeners = new Map<string, Map<RenderSize, Set<() => void>>>()
  private pins = new Map<string, Map<RenderSize, number>>()
  private pauses = 0
  private renders = 0
  private running = false
  private generation = 0
  private draws = new Map<string, Draw>()
  private budget: number
  private maxEntries: number
  // A single 4K common image may exceed the usual budget, but never grows unbounded.
  private contexts = new OutputContextCache(24 * 1024 * 1024, 8, 64 * 1024 * 1024)
  constructor(budget = 48 * 1024 * 1024, maxEntries = 256) { this.budget = budget; this.maxEntries = maxEntries }

  subscribe(files: readonly OutputFile[], size: RenderSize, listener: () => void) {
    const keys = new Set(files.map(file => file.renderKey))
    for (const key of keys) {
      const sizes = this.listeners.get(key) ?? new Map<RenderSize, Set<() => void>>()
      const callbacks = sizes.get(size) ?? new Set<() => void>()
      callbacks.add(listener); sizes.set(size, callbacks); this.listeners.set(key, sizes)
    }
    return () => {
      for (const key of keys) {
        const sizes = this.listeners.get(key), callbacks = sizes?.get(size)
        callbacks?.delete(listener)
        if (!callbacks?.size) sizes?.delete(size)
        if (!sizes?.size) this.listeners.delete(key)
      }
    }
  }
  get(file: OutputFile, size: RenderSize): RenderResult | undefined { return this.cache.get(file.renderKey)?.[size] }
  getStats() {
    return { bytes: [...this.cache.values()].reduce((total, sizes) => total + Object.values(sizes).reduce((n, result) => n + cost(result), 0), 0),
      entries: this.cache.size, pending: this.jobs.length, renders: this.renders,
      contextBytes: this.contexts.bytes, contextEntries: this.contexts.size, materialEffects: this.contexts.effectStats }
  }
  pause() {
    this.pauses++
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    let released = false
    return () => { if (released) return; released = true; this.pauses--; this.schedule() }
  }
  request(file: OutputFile, size: RenderSize, draw: Draw): () => void {
    const key = file.renderKey
    this.draws.set(key, draw)
    const sizes = this.pins.get(key) ?? new Map<RenderSize, number>()
    sizes.set(size, (sizes.get(size) ?? 0) + 1)
    this.pins.set(key, sizes)
    let job: Job | undefined
    if (!this.get(file, size)) {
      job = this.jobs.find(job => job.key === key && job.size === size)
      if (!job) { job = { key, size, draw, users: 0 }; this.jobs.push(job) }
      job.users++
      this.schedule()
    } else {
      const cached = this.cache.get(key)!
      this.cache.delete(key); this.cache.set(key, cached)
    }
    let released = false
    return () => {
      if (released) return
      released = true
      if (job && --job.users === 0) this.jobs = this.jobs.filter(pending => pending !== job)
      const count = (sizes.get(size) ?? 1) - 1
      if (count > 0) sizes.set(size, count)
      else sizes.delete(size)
      if (!sizes.size && this.pins.get(key) === sizes) this.pins.delete(key)
      if (!sizes.size && !this.cache.has(key) && !this.jobs.some(job => job.key === key)) this.draws.delete(key)
      this.trim()
    }
  }
  clear() {
    this.generation++
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    this.jobs = []; this.cache.clear(); this.pins.clear(); this.contexts.clear(); this.draws.clear()
    const callbacks = new Set([...this.listeners.values()].flatMap(sizes => [...sizes.values()].flatMap(listeners => [...listeners])))
    callbacks.forEach(listener => listener())
  }
  retry(file: OutputFile) {
    const draw = this.draws.get(file.renderKey)
    if (!draw) return
    this.cache.delete(file.renderKey)
    for (const [size, users] of this.pins.get(file.renderKey) ?? []) {
      this.jobs.push({ key: file.renderKey, size, users, draw })
      this.listeners.get(file.renderKey)?.get(size)?.forEach(listener => listener())
    }
    this.schedule()
  }
  private schedule() {
    if (this.timer !== undefined || this.running || this.pauses || !this.jobs.length) return
    this.timer = setTimeout(() => { this.timer = undefined; this.runNext() }, 0)
  }
  private trim() {
    let bytes = 0, retained = 0
    for (const [file, sizes] of this.cache) for (const size of Object.keys(sizes) as RenderSize[]) {
      if (this.pins.get(file)?.has(size)) bytes += cost(sizes[size])
    }
    for (const [file, sizes] of [...this.cache].reverse()) {
      for (const size of Object.keys(sizes).reverse() as RenderSize[]) {
        if (this.pins.get(file)?.has(size)) continue
        const sizeBytes = cost(sizes[size])
        if (bytes + sizeBytes > this.budget || retained >= this.maxEntries) delete sizes[size]
        else bytes += sizeBytes
      }
      if (!Object.keys(sizes).length) { this.cache.delete(file); this.draws.delete(file) }
      else retained++
    }
  }
  private async runNext() {
    this.jobs.sort((a, b) => priority[a.size] - priority[b.size])
    const first = this.jobs[0]
    if (!first) return
    this.running = true
    const generation = this.generation
    const cancelled = () => generation !== this.generation || !this.pins.has(first.key)
    const jobs = this.jobs.filter(job => job.key === first.key)
    this.jobs = this.jobs.filter(job => job.key !== first.key)
    const record = { ...this.cache.get(first.key) }
    let temporary: HTMLCanvasElement | undefined
    try {
      let source = record.full?.image ?? (first.size !== 'full' ? record.comparison?.image : undefined)
      if (!source) { source = await first.draw(this.contexts, cancelled); temporary = source.canvas; this.renders++ }
      if (cancelled()) return
      for (const job of jobs) {
        let image = source
        if (job.size !== 'full') {
          const canvas = document.createElement('canvas')
          const scale = job.size === 'check' ? 0 : Math.min(1, (job.size === 'thumbnail' ? 160 : 1024) / Math.max(source.canvas.width, source.canvas.height))
          canvas.width = Math.max(1, Math.round(source.canvas.width * scale))
          canvas.height = Math.max(1, Math.round(source.canvas.height * scale))
          if (job.size !== 'check') canvas.getContext('2d')!.drawImage(source.canvas, 0, 0, canvas.width, canvas.height)
          image = { ...source, canvas }
        }
        record[job.size] = { image }
      }
    } catch (error) {
      for (const job of jobs) record[job.size] = { error: error instanceof Error ? error.message : '画像を合成できませんでした' }
    } finally {
      this.running = false
      // A downsample-only job owns this temporary full-size composite. Release
      // its GPU/CPU backing store now; never resize a cached or displayed image.
      if (temporary && !Object.values(record).some(result => result?.image?.canvas === temporary)) {
        temporary.width = 1; temporary.height = 1
      }
      if (cancelled()) this.schedule()
    }
    if (cancelled()) return
    this.cache.delete(first.key); this.cache.set(first.key, record)
    this.trim()
    const callbacks = new Set(jobs.flatMap(job => [...(this.listeners.get(job.key)?.get(job.size) ?? [])]))
    callbacks.forEach(listener => listener())
    this.schedule()
  }
}

export const outputRenderQueue = new OutputRenderQueue()

export function renderOutputFile(file: OutputFile, table: ProjectSettings['processTable'], border: boolean, cache?: OutputRenderCache): RenderedOutput {
  return renderWithContextCache(cache, contexts => {
    const raw = file.renderCanvas(contexts)
    const sources = outputSources(raw)
    const canvas = applyRevisionBorders([{ ...file, canvas: raw }], table, border)[0].canvas
    const image = { canvas, sources, vectorWarning: hasVectorWarning(raw), unsupported3D: hasUnsupported3D(raw) }
    if (canvas !== raw) { raw.width = 1; raw.height = 1 }
    return image
  }, image => image.canvas)
}

export function renderOutputFileAsync(file: OutputFile, table: ProjectSettings['processTable'], border: boolean,
  cache?: OutputRenderCache, diagnostics: ClipDiagnostic[] = [], cancelled?: () => boolean): Promise<RenderedOutput> {
  const layers = collectRenderMaterials(() => file.renderCanvas(new Map()))
  return withPreparedMaterials(layers, () => {
    const image = renderOutputFile(file, table, border, cache)
    return { ...image, diagnostics: renderIssues(layers.filter(layer => image.sources.all.has(layer.id)), diagnostics) }
  }, cancelled)
}
