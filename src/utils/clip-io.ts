import type { ClipDocument, ClipLayer, ClipDiagnostic } from './clip/types'
import { MAX_INPUT_BYTES } from './image-budget'

interface ClipReader {
  decode(id: string): Promise<{ layer: ClipLayer; diagnostics: ClipDiagnostic[] }>
  dispose(): void
}
const readers = new WeakMap<ClipDocument, ClipReader>()
export const clipReader = (document: ClipDocument) => readers.get(document)

export function readClipFile(buffer: ArrayBuffer, includeRaster = true, lazy = false): Promise<ClipDocument> {
  if (buffer.byteLength > MAX_INPUT_BYTES) return Promise.reject(new Error('CLIPファイルは1 GiBまで読み込めます'))
  if (lazy && includeRaster) return readDeferredClip(buffer)
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./clip/worker.ts', import.meta.url), { type: 'module' })
    const timeout = setTimeout(() => finish(new Error('CLIPの読み込みが時間制限（2分）を超えました')), 120000)
    function finish(error?: Error, document?: ClipDocument) {
      clearTimeout(timeout)
      worker.terminate()
      if (error) reject(error)
      else resolve(document!)
    }
    worker.onmessage = (event: MessageEvent<{ document?: ClipDocument; error?: string }>) => {
      finish(event.data.error ? new Error(event.data.error) : undefined, event.data.document)
    }
    worker.onerror = () => finish(new Error('CLIP解析を開始できませんでした。アプリを再読み込みしてください'))
    worker.postMessage({ buffer, includeRaster }, [buffer])
  })
}

async function readDeferredClip(buffer: ArrayBuffer): Promise<ClipDocument> {
  const worker = new Worker(new URL('./clip/worker.ts', import.meta.url), { type: 'module' })
  type Reply = { document: ClipDocument; layer: ClipLayer; diagnostics: ClipDiagnostic[]; error?: string }
  const pending = new Map<number, { resolve: (reply: Reply) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>()
  let next = 0, closed = false
  const dispose = () => {
    closed = true
    worker.terminate()
    pending.forEach(p => { clearTimeout(p.timer); p.reject(new Error('CLIPの読み込みを終了しました')) })
    pending.clear()
  }
  const request = (data: object, transfer: Transferable[] = []) => new Promise<Reply>((resolve, reject) => {
    if (closed) { reject(new Error('CLIPの読み込みセッションが終了しています')); return }
    const id = ++next
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('素材の読み込みが時間制限（2分）を超えました。ファイルを開き直してください'))
      dispose()
    }, 120000)
    pending.set(id, { resolve, reject, timer })
    worker.postMessage({ ...data, id }, transfer)
  })
  worker.onmessage = (event: MessageEvent<Reply & { id: number }>) => {
    const p = pending.get(event.data.id)
    if (!p) return
    pending.delete(event.data.id); clearTimeout(p.timer)
    if (event.data.error) p.reject(new Error(event.data.error))
    else p.resolve(event.data)
  }
  worker.onerror = dispose
  try {
    const { document } = await request({ buffer, lazy: true }, [buffer])
    readers.set(document, { decode: id => request({ layerId: id }), dispose })
    return document
  } catch (error) { dispose(); throw error }
}
