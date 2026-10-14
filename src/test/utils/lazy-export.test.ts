import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_OUTPUT_CONFIG } from '../../types'
import type { ExportEntry, ExportProgressCallback } from '../../types/output'
import { prepareOutputEntries, streamOutputEntries } from '../../utils/output-builder'
import { buildZipStream } from '../../utils/zip-builder'
import { canvasToBlob } from '../../utils/image-export'

vi.mock('../../utils/image-export', async importOriginal => ({
  ...await importOriginal<typeof import('../../utils/image-export')>(),
  canvasToBlob: vi.fn(async () => new Blob(['encoded'])),
}))

function makeEntries(count: number) {
  const canvases: HTMLCanvasElement[] = []
  const draw = vi.fn(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1920; canvas.height = 1080
    canvases.push(canvas)
    return canvas
  })
  const entries: ExportEntry[] = Array.from({ length: count }, (_, i) => ({
    sourceLayerId: String(i), path: `A/A_${i}.jpg`, flatName: `A_${i}.jpg`, createCanvas: draw,
  }))
  return { entries, draw, canvases }
}

describe('lazy export', () => {
  it('waits for the save destination before rendering or encoding anything', async () => {
    const { entries, draw } = makeEntries(100)
    const stream = buildZipStream(entries, DEFAULT_OUTPUT_CONFIG)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(draw).not.toHaveBeenCalled()
    await stream.cancel()
    expect(draw).not.toHaveBeenCalled()
  })
  it('reports the current file before rendering, yields between images and releases pixels before saving the next', async () => {
    const { entries, draw, canvases } = makeEntries(100)
    const progress: Parameters<ExportProgressCallback>[] = []
    const prepared = prepareOutputEntries(entries, DEFAULT_OUTPUT_CONFIG)
    const iterator = streamOutputEntries(prepared, entries, DEFAULT_OUTPUT_CONFIG, 0, 0, (...args) => progress.push(args))
    const first = iterator.next()
    expect(draw).not.toHaveBeenCalled()
    expect(progress[0]).toEqual([0, 100, { phase: 'rendering', path: 'A_0.jpg' }])
    expect((await first).value).toMatchObject({ relativePath: 'A_0.jpg' })
    expect(draw).toHaveBeenCalledTimes(1)
    expect(canvases.map(canvas => canvas.width * canvas.height)).toEqual([1])
    expect(progress.some(([done]) => done === 1)).toBe(false)
    await iterator.next()
    expect(draw).toHaveBeenCalledTimes(2)
    expect(progress).toContainEqual([1, 100])
    expect(canvases.every(canvas => canvas.width === 1)).toBe(true)
    await iterator.return(undefined)
    expect(draw).toHaveBeenCalledTimes(2)
  })
  it('releases its owned canvas after encoding errors', async () => {
    const { entries, canvases } = makeEntries(2)
    vi.mocked(canvasToBlob).mockRejectedValueOnce(new Error('encoder failed'))
    const iterator = streamOutputEntries(prepareOutputEntries(entries, DEFAULT_OUTPUT_CONFIG), entries, DEFAULT_OUTPUT_CONFIG, 0, 0)
    await expect(iterator.next()).rejects.toThrow('encoder failed')
    expect(canvases[0].width).toBe(1)
    expect(canvases).toHaveLength(1)
  })
})
