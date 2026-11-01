// @vitest-environment node
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import * as codec from 'celcodec'
import { openClipSession, parseClipDocument } from '../../utils/clip/parser'
import { sessionFixture, sessionIds } from '../fixtures/clip-session'

const observed = vi.hoisted(() => ({ sessions: [] as codec.DocumentSession[] }))
vi.mock('celcodec', async importOriginal => {
  const actual = await importOriginal<typeof import('celcodec')>()
  return { ...actual, openDocument: (...args: Parameters<typeof actual.openDocument>) => {
    const session = actual.openDocument(...args); observed.sessions.push(session); return session
  } }
})

let SQL: SqlJsStatic, bytes: Uint8Array
beforeAll(async () => {
  SQL = await initSqlJs({ wasmBinary: new Uint8Array(readFileSync('node_modules/sql.js/dist/sql-wasm.wasm')).buffer })
  bytes = await sessionFixture(SQL)
})
afterEach(() => vi.restoreAllMocks())

function observeSessions() {
  observed.sessions.length = 0
  return observed.sessions
}

describe('public document session integration', () => {
  it('keeps saved opacity immutable, owns input copies and decodes fresh pixels by UUID', async () => {
    const sessions = observeSessions(), input = bytes.slice(), session = await openClipSession(input, SQL)
    input.fill(0)
    try {
      expect(session.document.layers[0].opacity).toBe(0.5)
      session.document.layers[0].opacity = 1
      expect(sessions[0].document.layers[0].opacity).toBe(0.5)
      expect(Object.isFrozen(sessions[0].document.layers[0])).toBe(true)
      const first = await session.decode(sessionIds.cel)
      expect(first.layer.pixels).toMatchObject({ left: 3, top: 5, width: 1, height: 1 })
      expect([...first.layer.pixels!.rgba]).toEqual([255, 0, 0, 255])
      first.layer.pixels!.rgba.fill(0)
      expect([...(await session.decode(sessionIds.cel)).layer.pixels!.rgba]).toEqual([255, 0, 0, 255])
      const folder = await session.decode(sessionIds.folder)
      expect(folder.layer.pixels).toBeUndefined()
      expect(sessions[0].resources().decodedCacheBytes).toBe(0)
    } finally { session.dispose(); session.dispose() }
    expect(sessions[0].resources()).toMatchObject({ closed: true, inputBytes: 0, metadataLayers: 0, activeDecodes: 0 })
  })

  it('preserves fractional playback boundaries and signed cel positions after FPS conversion', async () => {
    const fractional = await sessionFixture(SQL, [{ type: 'setTimelineFrameRate',
      timelineId: sessionIds.timeline, fps: 30, timingPolicy: 'preserve-time' }])
    const document = await parseClipDocument(fractional, SQL, false)
    const timeline = document.timelines[0]
    expect(timeline).toMatchObject({ uuid: sessionIds.timeline, startFrame: 1.25, endFrame: 28.75 })
    expect(timeline.data).toMatchObject({ fps: 30, duration: 27.5 })
    expect(timeline.data.tracks[0].frames.slice(0, 3)).toEqual([
      { frameIndex: -1.25, cellName: '1' }, { frameIndex: 3.75, cellName: null }, { frameIndex: 6.25, cellName: '1' },
    ])
    expect(timeline.diagnostics).toEqual([])
  })

  it('releases eager sessions on success and propagates cancellation without missing-content substitution', async () => {
    const sessions = observeSessions()
    const eager = await parseClipDocument(bytes, SQL)
    expect(eager.layers[0].children[0].pixels!.rgba[0]).toBe(255)
    expect(sessions[0].resources().inputBytes).toBe(0)
    const controller = new AbortController(), lazy = await openClipSession(bytes, SQL, { signal: controller.signal })
    controller.abort()
    await expect(lazy.decode(sessionIds.cel)).rejects.toMatchObject({ diagnostic: { code: 'CANCELLED' } })
    lazy.dispose()
    expect(sessions[1].resources().inputBytes).toBe(0)
  })

  it('accepts a 50,000px edge and decodes its sparse material within actual image budgets', async () => {
    const wide = await sessionFixture(SQL, [{ type: 'resizeCanvas', width: 50000, height: 64, anchor: 'top-left' }])
    const document = await parseClipDocument(wide, SQL)
    expect([document.width, document.height]).toEqual([50000, 64])
    expect(document.layers[0].children[0].pixels).toMatchObject({ width: 1, height: 1, left: 3, top: 5 })
  })

  it('restores sparse artwork on a 50,000 by 50,000 canvas with an actual-pixel budget', async () => {
    const large = await sessionFixture(SQL, [{ type: 'resizeCanvas', width: 50000, height: 50000, anchor: 'top-left' }], false)
    const sessions = observeSessions(), document = await parseClipDocument(large, SQL, false)
    expect([document.width, document.height]).toEqual([50000, 50000])
    const restored = await parseClipDocument(large, SQL)
    expect(restored.layers[0].children[0].pixels).toMatchObject({ width: 1, height: 1, left: 3, top: 5 })
    const lazy = await openClipSession(large, SQL)
    try {
      await expect(lazy.decode(sessionIds.cel, 3)).rejects.toMatchObject({ diagnostic: { code: 'LIMIT_MATERIAL_BYTES', kind: 'resource-limit' } })
      expect([...(await lazy.decode(sessionIds.cel, 4)).layer.pixels!.rgba]).toEqual([255, 0, 0, 255])
    } finally { lazy.dispose() }
    expect(sessions.every(s => s.resources().closed && s.resources().inputBytes === 0)).toBe(true)
  })
})
