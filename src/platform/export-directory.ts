import { isDesktopRuntime } from './runtime'

export interface DirectoryEntry { name: string; kind: 'file' | 'directory' | 'other' }
export interface ExportDirectory {
  id: string
  displayPath: string
  list: () => Promise<DirectoryEntry[]>
  directory: (name: string, create: boolean) => Promise<ExportDirectory>
  write: (name: string, input: Blob, overwrite: boolean) => Promise<void>
}
export class DestinationExistsError extends Error {
  constructor() { super('保存先に同名のファイルが作成されました') }
}

export function browserExportDirectory(handle: FileSystemDirectoryHandle, path = handle.name): ExportDirectory {
  return {
    id: path, displayPath: path,
    list: async () => {
      const result: DirectoryEntry[] = []
      const iterable = handle as FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> }
      for await (const entry of iterable.values()) result.push({ name: entry.name, kind: entry.kind })
      return result
    },
    directory: async (name, create) => browserExportDirectory(await handle.getDirectoryHandle(name, { create }), `${path}/${name}`),
    write: async (name, input, overwrite) => {
      if (!overwrite) {
        try {
          await handle.getFileHandle(name)
          throw new DestinationExistsError()
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error
        }
      }
      // The browser stages writes until close(). Unlike native create_new, the
      // File System Access API cannot atomically require an absent destination.
      const file = await handle.getFileHandle(name, { create: true })
      const writable = await file.createWritable()
      try {
        await writable.write(input)
        await writable.close()
      } catch (error) {
        await writable.abort().catch(() => {})
        throw error
      }
    },
  }
}

export function nativeExportDirectory(path: string): ExportDirectory {
  return {
    id: path.replace(/\\/g, '/'), displayPath: path,
    list: async () => {
      const { readDir } = await import('@tauri-apps/plugin-fs')
      return (await readDir(path)).map(entry => ({ name: entry.name,
        kind: entry.isSymlink ? 'other' : entry.isDirectory ? 'directory' : entry.isFile ? 'file' : 'other' }))
    },
    directory: async (name, create) => {
      const { join } = await import('@tauri-apps/api/path')
      const child = await join(path, name)
      if (create) {
        const { mkdir } = await import('@tauri-apps/plugin-fs')
        await mkdir(child)
      }
      return nativeExportDirectory(child)
    },
    write: async (name, input, overwrite) => {
      if (!isDesktopRuntime()) throw new Error('デスクトップの保存機能を利用できません')
      const { invoke } = await import('@tauri-apps/api/core')
      const { join } = await import('@tauri-apps/api/path')
      try {
        await invoke('write_export_file', new Uint8Array(await input.arrayBuffer()), {
          headers: { path: encodeURIComponent(await join(path, name)), overwrite: String(overwrite) },
        })
      } catch (error) {
        if (error === 'destination-exists') throw new DestinationExistsError()
        throw error instanceof Error ? error : new Error(String(error))
      }
    },
  }
}
