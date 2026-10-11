import type { ClipDocument } from './clip/types'

export function readClipFile(buffer: ArrayBuffer, includeRaster = true): Promise<ClipDocument> {
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
