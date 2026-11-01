import type { RenderComposition } from 'celcodec/render'
import type { ImageRegion } from 'celcodec'
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { openClipSession, parseClipDocument, type ClipSession } from './parser'
import type { ClipLayer } from './types'
import { ClipError, serializeClipError } from 'celcodec'

let session: ClipSession | undefined
let serial: Promise<void> = Promise.resolve()
let generation = 0
let sql: ReturnType<typeof initSqlJs> | undefined
function database() {
  return sql ??= (async () => {
    const response = await fetch(wasmUrl)
    if (!response.ok) throw new Error('CLIP解析用のWASMを読み込めませんでした')
    return initSqlJs({ wasmBinary: await response.arrayBuffer() })
  })().catch(error => { sql = undefined; throw error })
}
function transfers(layers: ClipLayer[]): ArrayBuffer[] {
  return layers.flatMap(layer => [
    ...(layer.pixels ? [layer.pixels.rgba.buffer as ArrayBuffer] : []),
    ...(layer.fragments ?? []).map(p => p.rgba.buffer as ArrayBuffer),
    ...(layer.mask ? [layer.mask.rgba.buffer as ArrayBuffer] : []),
    ...transfers(layer.children),
  ])
}
self.onmessage = (event: MessageEvent<{ id: number; buffer?: ArrayBuffer; includeRaster?: boolean; lazy?: boolean; layerId?: string; maxDecodedBytes?: number; composition?: RenderComposition; region?: ImageRegion; dispose?: boolean }>) => {
  const request = event.data
  if (request.dispose) {
    generation++
    session?.dispose(); session = undefined
    return
  }
  const requestedGeneration = generation
  const active = () => { if (requestedGeneration !== generation) throw new ClipError('CANCELLED') }
  serial = serial.then(async () => {
    try {
      active()
      if (request.composition) {
        if (!session || !request.region) throw new ClipError('CLOSED_DOCUMENT')
        const result = await session.render(request.composition, request.region)
        active()
        self.postMessage({ id: request.id, result }, { transfer: result.pixels ? [result.pixels.rgba.buffer] : [] })
      } else if (request.layerId) {
        if (!session) throw new ClipError('CLOSED_DOCUMENT')
        const result = await session.decode(request.layerId, request.maxDecodedBytes)
        active()
        self.postMessage({ id: request.id, ...result }, { transfer: [...new Set(transfers([result.layer]))] })
      } else {
        session?.dispose(); session = undefined
        const SQL = await database()
        active()
        let document
        if (request.lazy) {
          // The main thread transferred ownership. Borrow only within this Worker's lifetime.
          session = await openClipSession(new Uint8Array(request.buffer!), SQL, { ownership: 'borrow', canvas: (width, height) => new OffscreenCanvas(width, height) })
          document = session.document
        } else document = await parseClipDocument(new Uint8Array(request.buffer!), SQL, request.includeRaster, { ownership: 'borrow' })
        active()
        self.postMessage({ id: request.id, document }, { transfer: [...new Set(transfers(document.layers))] })
      }
    } catch (error) {
      if (!request.layerId && !request.composition) { session?.dispose(); session = undefined }
      self.postMessage(error instanceof ClipError ? { id: request.id, diagnostic: serializeClipError(error) }
        : { id: request.id, error: error instanceof Error ? error.message : 'CLIPを読み込めませんでした' })
    }
  })
}
