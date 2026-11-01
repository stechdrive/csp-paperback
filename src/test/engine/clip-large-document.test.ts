// @vitest-environment node
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { createCanvas } from '@napi-rs/canvas'
import { clipReader } from '../../utils/clip-io'
import { openClipSession } from '../../utils/clip/parser'
import { clipRenderingSource, buildClipLayerTree } from '../../engine/clip-tree'
import { disposeMaterials, materialStats } from '../../engine/material-cache'
import { releaseCanvas } from '../../engine/render-resources'
import { buildOutputPlan } from '../../utils/output-plan'
import { renderOutputRegion } from '../../utils/output-region-render'
import { renderOutputFileAsync } from '../../utils/output-render-queue'
import { ImageResourceError } from '../../utils/image-budget'
import { DEFAULT_PROJECT_SETTINGS, DEFAULT_OUTPUT_CONFIG } from '../../types'
import { sessionFixture } from '../fixtures/clip-session'

vi.mock('../../utils/clip-io', () => ({ clipReader: vi.fn() }))
let SQL: SqlJsStatic
beforeAll(async () => { SQL = await initSqlJs({ wasmBinary: new Uint8Array(readFileSync('node_modules/sql.js/dist/sql-wasm.wasm')).buffer }) })
afterEach(() => vi.unstubAllGlobals())

it('restores and composites a real sparse material in a 50,000px square without allocating the document bitmap', async () => {
  const allocations: number[] = []
  vi.stubGlobal('document', { createElement: (tag: string) => {
    if (tag !== 'canvas') throw new Error(tag)
    const canvas = createCanvas(1, 1)
    const width = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(canvas), 'width')!
    Object.defineProperty(canvas, 'width', { get: () => width.get!.call(canvas), set: (value: number) => {
      allocations.push(value); width.set!.call(canvas, value)
    } })
    return canvas
  } })
  const bytes = await sessionFixture(SQL, [{ type: 'resizeCanvas', width: 50000, height: 50000, anchor: 'top-left' }], false)
  const session = await openClipSession(bytes, SQL, { canvas: createCanvas }), dispose = vi.spyOn(session, 'dispose')
  vi.mocked(clipReader).mockReturnValue(session)
  const clip = session.document, source = clipRenderingSource(clip)
  try {
    const tree = buildClipLayerTree(clip, source, clip.timelines[0], DEFAULT_PROJECT_SETTINGS, false)
    const files = buildOutputPlan(tree, { projectSettings: DEFAULT_PROJECT_SETTINGS, docWidth: 50000, docHeight: 50000,
      virtualSets: [], timelineData: clip.timelines[0].data, outputConfig: { ...DEFAULT_OUTPUT_CONFIG, background: 'transparent' } })
    expect(files).toHaveLength(1)
    const image = await renderOutputRegion(files[0], { left: 0, top: 0, width: 32, height: 32 }, 1, [], false)
    expect([...image.canvas.getContext('2d')!.getImageData(3, 5, 1, 1).data]).toEqual([255, 0, 0, 255])
    expect(materialStats().bytes).toBeLessThanOrEqual(8)
    expect(Math.max(...allocations)).toBeLessThan(100)
    releaseCanvas(image.canvas)
    // The Canvas/JPEG path still has an allocation limit. Never silently
    // turn an allocation failure into a successful blank export.
    await expect(renderOutputFileAsync(files[0], [], false)).rejects.toBeInstanceOf(ImageResourceError)
  } finally { disposeMaterials(source) }
  expect(dispose).toHaveBeenCalledOnce()
  expect(materialStats().bytes).toBe(0)
})
