import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'
import { openClipSession, parseClipDocument } from '../../utils/clip/parser'
import type { ClipDiagnostic, ClipDocument, ClipLayer, ClipPixels } from '../../utils/clip/types'

vi.mock('sql.js', () => ({ default: vi.fn().mockResolvedValue({}) }))
vi.mock('../../utils/clip/parser', () => ({ openClipSession: vi.fn(), parseClipDocument: vi.fn() }))

type Request = { id: number; buffer?: ArrayBuffer; includeRaster?: boolean; lazy?: boolean; layerId?: string }
type Reply = { id: number; document?: ClipDocument; layer?: ClipLayer; diagnostics?: ClipDiagnostic[]; error?: string }
const awaiting = new Map<number, (value: Reply) => void>()
const scope = {
  onmessage: null as ((event: MessageEvent<Request>) => void) | null,
  postMessage: vi.fn((reply: Reply, options?: { transfer: ArrayBuffer[] }) => {
    // Exercise actual structured cloning and ownership transfer across the boundary.
    const received = structuredClone(reply, options)
    awaiting.get(reply.id)!(received)
    awaiting.delete(reply.id)
  }),
}
const pixels = (value: number): ClipPixels => ({ width: 1, height: 1, left: 0, top: 0, rgba: new Uint8ClampedArray([value, 0, 0, 255]) })
const layer = (id = 'art'): ClipLayer => ({
  id, name: id, isFolder: false, isAnimationFolder: false, expanded: true, hidden: false,
  opacity: 1, blendMode: 'normal', clipping: false, children: [],
})
const document = (layers: ClipLayer[] = []): ClipDocument => ({ width: 1, height: 1, dpi: 72, layers, timelines: [], defaultTimelineId: null, diagnostics: [] })
function send(request: Request): Promise<Reply> {
  return new Promise(resolve => {
    awaiting.set(request.id, resolve)
    scope.onmessage!(new MessageEvent('message', { data: request }))
  })
}
beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  awaiting.clear()
  vi.stubGlobal('self', scope)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
  await import('../../utils/clip/worker')
})
afterEach(() => vi.unstubAllGlobals())

describe('CLIP Worker protocol', () => {
  it('transfers nested artwork, fragments and masks without losing their pixel bytes', async () => {
    const art = { ...layer(), pixels: pixels(10), fragments: [pixels(20)], mask: pixels(30), children: [{ ...layer('child'), pixels: pixels(40) }] }
    vi.mocked(parseClipDocument).mockResolvedValue(document([art, layer('empty')]))
    const buffer = new Uint8Array([1, 2, 3]).buffer
    const reply = await send({ id: 10, buffer, includeRaster: false })
    expect(initSqlJs).toHaveBeenCalledWith({ wasmBinary: expect.any(ArrayBuffer) })
    expect(parseClipDocument).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), {}, false)
    const transferred = reply.document!.layers[0]
    expect([transferred.pixels, transferred.fragments![0], transferred.mask, transferred.children[0].pixels].map(p => p!.rgba[0]))
      .toEqual([10, 20, 30, 40])
    for (const p of [art.pixels, art.fragments[0], art.mask, art.children[0].pixels]) expect(p.rgba.byteLength).toBe(0)
    expect(scope.postMessage.mock.calls[0][1]!.transfer).toHaveLength(4)
  })

  it('keeps lazy decode requests in order and returns layer diagnostics with each request ID', async () => {
    const decode = vi.fn()
    vi.mocked(openClipSession).mockResolvedValue({ document: document([layer()]), decode })
    await send({ id: 1, buffer: new ArrayBuffer(1), lazy: true })
    expect(parseClipDocument).not.toHaveBeenCalled()
    let finish!: (value: { layer: ClipLayer; diagnostics: ClipDiagnostic[] }) => void
    decode.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockResolvedValueOnce({ layer: layer('second'), diagnostics: [] })
    const first = send({ id: 2, layerId: 'first' })
    const second = send({ id: 3, layerId: 'second' })
    await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce())
    const diagnostics: ClipDiagnostic[] = [{ scope: 'raster', layerId: 'first', outcome: 'approximate', message: '近似描画' }]
    finish({ layer: { ...layer('first'), pixels: pixels(50) }, diagnostics })
    expect(await first).toMatchObject({ id: 2, layer: { id: 'first' }, diagnostics })
    expect(await second).toMatchObject({ id: 3, layer: { id: 'second' }, diagnostics: [] })
    expect(decode.mock.calls.map(([id]) => id)).toEqual(['first', 'second'])
    expect(scope.postMessage.mock.calls.map(([reply]) => reply.id)).toEqual([1, 2, 3])
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('reports a missing session and a failed WASM load without poisoning the request queue', async () => {
    expect(await send({ id: 1, layerId: 'missing' })).toEqual({ id: 1, error: 'CLIPの読み込みセッションがありません' })
    expect(fetch).not.toHaveBeenCalled()
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response)
    expect(await send({ id: 2, buffer: new ArrayBuffer(1) })).toEqual({ id: 2, error: 'CLIP解析用のWASMを読み込めませんでした' })
    expect(initSqlJs).not.toHaveBeenCalled()
    vi.mocked(parseClipDocument).mockResolvedValueOnce(document())
    expect(await send({ id: 3, buffer: new ArrayBuffer(1) })).toEqual({ id: 3, document: document() })
  })

  it('turns decode errors into isolated replies and continues with the next layer', async () => {
    const decode = vi.fn().mockRejectedValueOnce(new Error('破損した素材')).mockRejectedValueOnce('unknown failure')
      .mockResolvedValueOnce({ layer: layer(), diagnostics: [] })
    vi.mocked(openClipSession).mockResolvedValue({ document: document(), decode })
    await send({ id: 1, buffer: new ArrayBuffer(1), lazy: true })
    expect(await send({ id: 2, layerId: 'broken' })).toEqual({ id: 2, error: '破損した素材' })
    expect(await send({ id: 3, layerId: 'unknown' })).toEqual({ id: 3, error: 'CLIPを読み込めませんでした' })
    expect(await send({ id: 4, layerId: 'art' })).toMatchObject({ id: 4, layer: { id: 'art' }, diagnostics: [] })
  })
})
