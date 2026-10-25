import { downloadBlob } from '../utils/zip-builder'
import { createAbortError, isDesktopRuntime } from './runtime'

/** Choose the destination before rendering; cancellation never creates/truncates a file. */
export async function savePsdFile(name: string, create: () => Promise<ArrayBuffer>): Promise<void> {
  if (isDesktopRuntime()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const path = await save({ title: 'PSDを書き出す', defaultPath: name, filters: [{ name: 'Photoshop document', extensions: ['psd'] }] })
    if (path === null) throw createAbortError()
    if (!/\.psd$/i.test(path)) throw new Error('保存ファイル名の末尾を .psd にしてください')
    const bytes = new Uint8Array(await create())
    const { invoke } = await import('@tauri-apps/api/core')
    try {
      await invoke('write_export_file', bytes, { headers: { path: encodeURIComponent(path), overwrite: 'true' } })
    } catch (error) { throw error instanceof Error ? error : new Error(String(error)) }
    return
  }
  const picker = (window as unknown as { showSaveFilePicker?: (options: {
    suggestedName: string; types: { description: string; accept: Record<string, string[]> }[]
  }) => Promise<FileSystemFileHandle> }).showSaveFilePicker
  if (picker) {
    const handle = await picker({ suggestedName: name, types: [{ description: 'Photoshop document', accept: { 'image/vnd.adobe.photoshop': ['.psd'] } }] })
    const bytes = await create()
    const writable = await handle.createWritable()
    try { await writable.write(new Blob([bytes])); await writable.close() }
    catch (error) { await writable.abort().catch(() => {}); throw error }
  } else {
    downloadBlob(new Blob([await create()], { type: 'image/vnd.adobe.photoshop' }), name)
  }
}
