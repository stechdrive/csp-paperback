import type { OutputFile } from './output-plan'
import type { ProjectSettings } from '../types'
import { applyRevisionBorders } from './revision-border'
import { outputSources } from '../engine/render-sources'
import { hasVectorWarning, hasUnsupported3D } from '../engine/render-warning'

export interface RenderedOutput {
  canvas: HTMLCanvasElement
  sources: ReturnType<typeof outputSources>
  vectorWarning: boolean
  unsupported3D: boolean
}
export type RenderSize = 'full' | 'comparison' | 'thumbnail'
export type RenderResult = { image?: RenderedOutput; error?: string }
type Job = { file: OutputFile; size: RenderSize; draw: () => RenderedOutput; users: number }
const priority = { full: 0, comparison: 1, thumbnail: 2 }
const cost = (result?: RenderResult) => result?.image ? result.image.canvas.width * result.image.canvas.height * 4 : 0

/** Only visible consumers pin pixels. Notifications are scoped to each file/resolution. */
export class OutputRenderQueue {
  private jobs: Job[] = []
  private cache = new Map<OutputFile, Partial<Record<RenderSize, RenderResult>>>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private listeners = new Map<OutputFile, Map<RenderSize, Set<() => void>>>()
  private pins = new Map<OutputFile, Map<RenderSize, number>>()
  private pauses = 0
  private renders = 0
  private budget: number
  private maxEntries: number
  constructor(budget = 48 * 1024 * 1024, maxEntries = 256) { this.budget = budget; this.maxEntries = maxEntries }

  subscribe(files: readonly OutputFile[], size: RenderSize, listener: () => void) {
    for (const file of files) {
      const sizes = this.listeners.get(file) ?? new Map<RenderSize, Set<() => void>>()
      const callbacks = sizes.get(size) ?? new Set<() => void>()
      callbacks.add(listener); sizes.set(size, callbacks); this.listeners.set(file, sizes)
    }
    return () => {
      for (const file of files) {
        const sizes = this.listeners.get(file), callbacks = sizes?.get(size)
        callbacks?.delete(listener)
        if (!callbacks?.size) sizes?.delete(size)
        if (!sizes?.size) this.listeners.delete(file)
      }
    }
  }
  get(file: OutputFile, size: RenderSize): RenderResult | undefined { return this.cache.get(file)?.[size] }
  getStats() {
    return { bytes: [...this.cache.values()].reduce((total, sizes) => total + Object.values(sizes).reduce((n, result) => n + cost(result), 0), 0),
      entries: this.cache.size, pending: this.jobs.length, renders: this.renders }
  }
  pause() {
    this.pauses++
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    let released = false
    return () => { if (released) return; released = true; this.pauses--; this.schedule() }
  }
  request(file: OutputFile, size: RenderSize, draw: () => RenderedOutput): () => void {
    const sizes = this.pins.get(file) ?? new Map<RenderSize, number>()
    sizes.set(size, (sizes.get(size) ?? 0) + 1)
    this.pins.set(file, sizes)
    let job: Job | undefined
    if (!this.get(file, size)) {
      job = this.jobs.find(job => job.file === file && job.size === size)
      if (!job) { job = { file, size, draw, users: 0 }; this.jobs.push(job) }
      job.users++
      this.schedule()
    } else {
      const cached = this.cache.get(file)!
      this.cache.delete(file); this.cache.set(file, cached)
    }
    let released = false
    return () => {
      if (released) return
      released = true
      if (job && --job.users === 0) this.jobs = this.jobs.filter(pending => pending !== job)
      const count = (sizes.get(size) ?? 1) - 1
      if (count > 0) sizes.set(size, count)
      else sizes.delete(size)
      if (!sizes.size && this.pins.get(file) === sizes) this.pins.delete(file)
      this.trim()
    }
  }
  clear() {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    this.jobs = []; this.cache.clear(); this.pins.clear()
    const callbacks = new Set([...this.listeners.values()].flatMap(sizes => [...sizes.values()].flatMap(listeners => [...listeners])))
    callbacks.forEach(listener => listener())
  }
  private schedule() {
    if (this.timer !== undefined || this.pauses || !this.jobs.length) return
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
      if (!Object.keys(sizes).length) this.cache.delete(file)
      else retained++
    }
  }
  private runNext() {
    this.jobs.sort((a, b) => priority[a.size] - priority[b.size])
    const first = this.jobs[0]
    if (!first) return
    const jobs = this.jobs.filter(job => job.file === first.file)
    this.jobs = this.jobs.filter(job => job.file !== first.file)
    const record = { ...this.cache.get(first.file) }
    let temporary: HTMLCanvasElement | undefined
    try {
      let source = record.full?.image ?? (first.size !== 'full' ? record.comparison?.image : undefined)
      if (!source) { source = first.draw(); temporary = source.canvas; this.renders++ }
      for (const job of jobs) {
        let image = source
        if (job.size !== 'full') {
          const canvas = document.createElement('canvas')
          const scale = Math.min(1, (job.size === 'thumbnail' ? 160 : 1024) / Math.max(source.canvas.width, source.canvas.height))
          canvas.width = Math.max(1, Math.round(source.canvas.width * scale))
          canvas.height = Math.max(1, Math.round(source.canvas.height * scale))
          canvas.getContext('2d')!.drawImage(source.canvas, 0, 0, canvas.width, canvas.height)
          image = { ...source, canvas }
        }
        record[job.size] = { image }
      }
    } catch (error) {
      for (const job of jobs) record[job.size] = { error: error instanceof Error ? error.message : '画像を合成できませんでした' }
    } finally {
      // A downsample-only job owns this temporary full-size composite. Release
      // its GPU/CPU backing store now; never resize a cached or displayed image.
      if (temporary && !Object.values(record).some(result => result?.image?.canvas === temporary)) {
        temporary.width = 1; temporary.height = 1
      }
    }
    this.cache.delete(first.file); this.cache.set(first.file, record)
    this.trim()
    const callbacks = new Set(jobs.flatMap(job => [...(this.listeners.get(job.file)?.get(job.size) ?? [])]))
    callbacks.forEach(listener => listener())
    this.schedule()
  }
}

export const outputRenderQueue = new OutputRenderQueue()

export function renderOutputFile(file: OutputFile, table: ProjectSettings['processTable'], border: boolean, cache: Parameters<OutputFile['renderCanvas']>[0] = new Map()): RenderedOutput {
  const raw = file.renderCanvas(cache)
  const sources = outputSources(raw)
  const canvas = applyRevisionBorders([{ ...file, canvas: raw }], table, border)[0].canvas
  const image = { canvas, sources, vectorWarning: hasVectorWarning(raw), unsupported3D: hasUnsupported3D(raw) }
  if (canvas !== raw) { raw.width = 1; raw.height = 1 }
  return image
}
