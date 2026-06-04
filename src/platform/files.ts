import { downloadBlob } from '../utils/zip-builder'
import { createAbortError, isDesktopRuntime } from './runtime'

export interface LoadableFile {
  name: string
  text: () => Promise<string>
  arrayBuffer: () => Promise<ArrayBuffer>
}

class TauriLoadableFile implements LoadableFile {
  readonly name: string
  private readonly path: string

  constructor(path: string) {
    this.path = path
    this.name = fileNameFromPath(path)
  }

  async text(): Promise<string> {
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    return readTextFile(this.path)
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const { readFile } = await import('@tauri-apps/plugin-fs')
    const bytes = await readFile(this.path)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}

export function supportsNativeOpenDialog(): boolean {
  return isDesktopRuntime()
}

export async function pickProjectFiles(): Promise<LoadableFile[]> {
  if (!isDesktopRuntime()) return []

  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({
    title: 'PSD / XDTS / 工程設定JSON を開く',
    multiple: true,
    filters: [
      { name: 'CSP Paperback files', extensions: ['psd', 'xdts', 'json'] },
      { name: 'All files', extensions: ['*'] },
    ],
  })

  if (selected === null) return []
  const paths = Array.isArray(selected) ? selected : [selected]
  return paths.map(path => new TauriLoadableFile(path))
}

export async function pickSettingsJsonFile(): Promise<LoadableFile | null> {
  if (!isDesktopRuntime()) return null

  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({
    title: '工程設定JSONを読み込む',
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })

  return selected === null ? null : new TauriLoadableFile(selected)
}

export async function saveTextFile(
  fileName: string,
  text: string,
  description = 'Text file',
  extensions = ['txt'],
): Promise<void> {
  if (isDesktopRuntime()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({
      title: 'ファイルを保存',
      defaultPath: fileName,
      filters: [{ name: description, extensions }],
    })
    if (path === null) throw createAbortError()

    await writeTextFile(path, text)
    return
  }

  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), fileName)
}
