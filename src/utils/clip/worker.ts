import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { openClipSession, parseClipDocument, type ClipSession } from './parser'
import type { ClipLayer } from './types'

let session: ClipSession | undefined
let serial: Promise<void> = Promise.resolve()
function transfers(layers: ClipLayer[]): ArrayBuffer[] {
  return layers.flatMap(layer => [
    ...(layer.pixels ? [layer.pixels.rgba.buffer as ArrayBuffer] : []),
    ...(layer.fragments ?? []).map(p => p.rgba.buffer as ArrayBuffer),
    ...(layer.mask ? [layer.mask.rgba.buffer as ArrayBuffer] : []),
    ...transfers(layer.children),
  ])
}
self.onmessage = (event: MessageEvent<{ id: number; buffer?: ArrayBuffer; includeRaster?: boolean; lazy?: boolean; layerId?: string }>) => {
  const request = event.data
  serial = serial.then(async () => {
    try {
      if (request.layerId) {
        if (!session) throw new Error('CLIPの読み込みセッションがありません')
        const result = await session.decode(request.layerId)
        self.postMessage({ id: request.id, ...result }, { transfer: transfers([result.layer]) })
      } else {
        const response = await fetch(wasmUrl)
        if (!response.ok) throw new Error('CLIP解析用のWASMを読み込めませんでした')
        const SQL = await initSqlJs({ wasmBinary: await response.arrayBuffer() })
        let document
        if (request.lazy) {
          session = await openClipSession(new Uint8Array(request.buffer!), SQL)
          document = session.document
        } else document = await parseClipDocument(new Uint8Array(request.buffer!), SQL, request.includeRaster)
        self.postMessage({ id: request.id, document }, { transfer: transfers(document.layers) })
      }
    } catch (error) {
      self.postMessage({ id: request.id, error: error instanceof Error ? error.message : 'CLIPを読み込めませんでした' })
    }
  })
}
