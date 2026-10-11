import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { parseClipDocument } from './parser'
import type { ClipLayer } from './types'

self.onmessage = async (event: MessageEvent<{ buffer: ArrayBuffer; includeRaster: boolean }>) => {
  try {
    // wasmBinary avoids sql.js selecting its Node loader in packaged webviews.
    const response = await fetch(wasmUrl)
    if (!response.ok) throw new Error('CLIP解析用のWASMを読み込めませんでした')
    const SQL = await initSqlJs({ wasmBinary: await response.arrayBuffer() })
    const document = await parseClipDocument(new Uint8Array(event.data.buffer), SQL, event.data.includeRaster)
    const transfer: ArrayBuffer[] = []
    const collect = (layers: ClipLayer[]) => {
      for (const layer of layers) {
        if (layer.pixels) transfer.push(layer.pixels.rgba.buffer as ArrayBuffer)
        for (const fragment of layer.fragments ?? []) transfer.push(fragment.rgba.buffer as ArrayBuffer)
        if (layer.mask) transfer.push(layer.mask.rgba.buffer as ArrayBuffer)
        collect(layer.children)
      }
    }
    collect(document.layers)
    self.postMessage({ document }, { transfer })
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : 'CLIPを読み込めませんでした' })
  }
}
