import type { RenderComposition, CompositionRenderResult } from 'celcodec/render'
import type { ImageRegion } from 'celcodec'
import { deserializeClipError, type ClipDiagnostic as NativeDiagnostic } from 'celcodec'
import type { ClipDocument, ClipLayer, ClipDiagnostic } from './clip/types'
import { codecException } from './clip/celcodec'
import { MAX_INPUT_BYTES } from './image-budget'

export interface ClipReader {
  render(composition: RenderComposition, region: ImageRegion): Promise<CompositionRenderResult>
  decode(id: string, maxDecodedBytes?: number): Promise<{ layer: ClipLayer; diagnostics: ClipDiagnostic[] }>
  dispose(): void
}
const readers = new WeakMap<ClipDocument, ClipReader>()
export const clipReader = (document: ClipDocument) => readers.get(document)
type Reply = { result: CompositionRenderResult; id: number; document: ClipDocument; layer: ClipLayer; diagnostics: ClipDiagnostic[];
  diagnostic?: NativeDiagnostic; error?: string }

/** Consumes buffer by transfer. Abort/dispose terminates the Worker, including synchronous SQL. */
export async function readClipFile(buffer: ArrayBuffer, includeRaster = true, lazy = false,
  signal?: AbortSignal): Promise<ClipDocument> {
  if (signal?.aborted) throw new DOMException('CLIPの読み込みを中止しました', 'AbortError')
  if (buffer.byteLength > MAX_INPUT_BYTES) throw new Error('CLIPファイルは1 GiBまで読み込めます')
  const worker = new Worker(new URL('./clip/worker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<number, { resolve: (reply: Reply) => void; reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout> }>()
  let next = 0, closed = false
  const dispose = (error = new Error('CLIPの読み込みを終了しました')) => {
    if (closed) return
    closed = true
    signal?.removeEventListener('abort', abort)
    // A queued dispose cannot interrupt synchronous native work. Termination is
    // the authoritative release of the session, compressed input and WASM heap.
    worker.terminate()
    pending.forEach(p => { clearTimeout(p.timer); p.reject(error) })
    pending.clear()
  }
  const abort = () => dispose(new DOMException('CLIPの読み込みを中止しました', 'AbortError'))
  signal?.addEventListener('abort', abort, { once: true })
  const request = (data: object, transfer: Transferable[] = []) => new Promise<Reply>((resolve, reject) => {
    if (closed) { reject(new Error('CLIPの読み込みセッションが終了しています')); return }
    const id = ++next
    const timer = setTimeout(() => dispose(new Error(
      '素材の読み込みが時間制限（2分）を超えました。ファイルを開き直してください')), 120000)
    pending.set(id, { resolve, reject, timer })
    try { worker.postMessage({ ...data, id }, transfer) }
    catch (error) { dispose(error instanceof Error || error instanceof DOMException
      ? error : new Error('CLIPをWorkerへ転送できませんでした')) }
  })
  worker.onmessage = (event: MessageEvent<Reply>) => {
    const p = pending.get(event.data.id)
    if (!p) return
    pending.delete(event.data.id); clearTimeout(p.timer)
    if (event.data.diagnostic) p.reject(codecException(deserializeClipError(event.data.diagnostic)))
    else if (event.data.error) p.reject(new Error(event.data.error))
    else p.resolve(event.data)
  }
  worker.onerror = () => dispose(new Error('CLIP解析を開始できませんでした。アプリを再読み込みしてください'))
  worker.onmessageerror = () => dispose(new Error('CLIP解析の結果を受信できませんでした。ファイルを開き直してください'))
  try {
    const deferred = lazy && includeRaster
    const { document } = await request({ buffer, includeRaster, lazy: deferred }, [buffer])
    if (deferred) readers.set(document, { render: async (composition, region) => (await request({ composition, region })).result, decode: (id, maxDecodedBytes) => request({ layerId: id, maxDecodedBytes }), dispose })
    else dispose()
    return document
  } catch (error) { dispose(); throw error }
}
