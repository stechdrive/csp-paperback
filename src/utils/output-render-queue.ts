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
type Job = { file: OutputFile; size: RenderSize; draw: () => RenderedOutput; users: number }
type Result = { image?: RenderedOutput; error?: string }

/** Bounded image cache. Jobs yield between images; full previews precede thumbnails. */
export class OutputRenderQueue {
  private jobs: Job[] = []
  private cache = new Map<OutputFile, Partial<Record<RenderSize, Result>>>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private listeners = new Set<() => void>()
  private version = 0
  private pins = new Map<OutputFile, Map<RenderSize, number>>()
  private budget: number
  constructor(budget = 80 * 1024 * 1024) { this.budget = budget }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getVersion = () => this.version
  get(file: OutputFile, size: RenderSize): Result | undefined { return this.cache.get(file)?.[size] }
  request(file: OutputFile, size: RenderSize, draw: () => RenderedOutput): () => void {
    const sizes = this.pins.get(file) ?? new Map<RenderSize, number>()
    sizes.set(size, (sizes.get(size) ?? 0) + 1)
    this.pins.set(file, sizes)
    const unpin = () => {
      const count = (sizes.get(size) ?? 1) - 1
      if (count > 0) sizes.set(size, count)
      else sizes.delete(size)
      if (!sizes.size && this.pins.get(file) === sizes) this.pins.delete(file)
    }
    if (this.get(file, size)) return unpin
    let job = this.jobs.find(job => job.file === file && job.size === size)
    if (!job) { job = { file, size, draw, users: 0 }; this.jobs.push(job) }
    job.users++
    this.schedule()
    return () => { job.users--; unpin() }
  }
  clear() {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    this.jobs = []
    this.cache.clear()
    this.pins.clear()
    this.changed()
  }
  private changed() { this.version++; this.listeners.forEach(listener => listener()) }
  private schedule() {
    if (this.timer !== undefined) return
    this.timer = setTimeout(() => { this.timer = undefined; this.runNext() }, 0)
  }
  private runNext() {
    this.jobs = this.jobs.filter(job => job.users > 0)
    this.jobs.sort((a, b) => Number(a.size !== 'full') - Number(b.size !== 'full'))
    const job = this.jobs.shift()
    if (!job) return
    let result: Result
    try {
      let image = this.get(job.file, 'full')?.image ?? job.draw()
      if (job.size !== 'full') {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, (job.size === 'thumbnail' ? 160 : 1024) / Math.max(image.canvas.width, image.canvas.height))
        canvas.width = Math.max(1, Math.round(image.canvas.width * scale))
        canvas.height = Math.max(1, Math.round(image.canvas.height * scale))
        canvas.getContext('2d')!.drawImage(image.canvas, 0, 0, canvas.width, canvas.height)
        image = { ...image, canvas }
      }
      result = { image }
    } catch (error) { result = { error: error instanceof Error ? error.message : '画像を合成できませんでした' } }
    const record = { ...this.cache.get(job.file), [job.size]: result }
    this.cache.delete(job.file)
    this.cache.set(job.file, record)
    // Pin each resolution separately: a visible thumbnail must not keep an old
    // full-size preview alive. Mounted images may exceed the cache budget.
    // Eviction releases references without zeroing canvases held by views.
    const cost = (result: Result) => result.image ? result.image.canvas.width * result.image.canvas.height * 4 : 0
    let bytes = 0
    for (const [key, value] of this.cache) {
      for (const size of Object.keys(value) as RenderSize[]) {
        if (this.pins.get(key)?.has(size)) bytes += cost(value[size]!)
      }
    }
    for (const [key, value] of [...this.cache].reverse()) {
      for (const size of Object.keys(value).reverse() as RenderSize[]) {
        if (this.pins.get(key)?.has(size)) continue
        const sizeBytes = cost(value[size]!)
        if (bytes + sizeBytes > this.budget) delete value[size]
        else bytes += sizeBytes
      }
      if (!Object.keys(value).length) this.cache.delete(key)
    }
    this.changed()
    if (this.jobs.length) this.schedule()
  }
}

export const outputRenderQueue = new OutputRenderQueue()

export function renderOutputFile(file: OutputFile, table: ProjectSettings['processTable'], border: boolean): RenderedOutput {
  const raw = file.renderCanvas(new Map())
  const sources = outputSources(raw)
  const canvas = applyRevisionBorders([{ ...file, canvas: raw }], table, border)[0].canvas
  return { canvas, sources, vectorWarning: hasVectorWarning(raw), unsupported3D: hasUnsupported3D(raw) }
}
