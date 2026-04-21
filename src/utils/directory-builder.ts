import type { OutputConfig, OutputEntry } from '../types'
import { makeExportBaseName, prepareOutputEntries, streamOutputEntries } from './output-builder'

type ShowDirectoryPicker = (options?: {
  id?: string
  mode?: 'read' | 'readwrite'
}) => Promise<FileSystemDirectoryHandle>

function getDirectoryPicker(): ShowDirectoryPicker | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { showDirectoryPicker?: ShowDirectoryPicker }).showDirectoryPicker
}

export function supportsDirectoryExport(): boolean {
  return typeof getDirectoryPicker() === 'function'
}

export async function saveEntriesToDirectory(
  entries: OutputEntry[],
  config: OutputConfig,
  psdFileName: string,
  dpiX = 0,
  dpiY = 0,
  onProgress?: (done: number, total: number) => void,
): Promise<string> {
  const directoryPicker = getDirectoryPicker()
  if (!directoryPicker) {
    throw new Error('このブラウザではフォルダ書き出しに対応していません')
  }

  const targetDirectory = await directoryPicker({
    id: 'csp-paperback-export',
    mode: 'readwrite',
  })
  const exportRoot = await createUniqueChildDirectory(
    targetDirectory,
    makeExportBaseName(psdFileName),
  )
  const preparedEntries = prepareOutputEntries(entries, config)
  const directoryCache = new Map<string, FileSystemDirectoryHandle>()

  for await (const entry of streamOutputEntries(
    preparedEntries,
    entries,
    config,
    dpiX,
    dpiY,
    onProgress,
  )) {
    const parentDirectory = await ensureDirectoryPath(
      exportRoot,
      entry.segments.slice(0, -1),
      directoryCache,
    )
    const fileHandle = await parentDirectory.getFileHandle(entry.fileName, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(entry.input)
    await writable.close()
  }

  return exportRoot.name
}

async function createUniqueChildDirectory(
  parent: FileSystemDirectoryHandle,
  baseName: string,
): Promise<FileSystemDirectoryHandle> {
  for (let index = 0; index < 1000; index++) {
    const candidate = index === 0 ? baseName : `${baseName}_${index + 1}`
    try {
      await parent.getDirectoryHandle(candidate)
      continue
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === 'NotFoundError' || error.name === 'TypeMismatchError')
      ) {
        return parent.getDirectoryHandle(candidate, { create: true })
      }
      throw error
    }
  }

  throw new Error('保存先フォルダ名の競合が多すぎるため書き出しを中止しました')
}

async function ensureDirectoryPath(
  root: FileSystemDirectoryHandle,
  segments: string[],
  cache: Map<string, FileSystemDirectoryHandle>,
): Promise<FileSystemDirectoryHandle> {
  let current = root
  let path = ''

  for (const segment of segments) {
    path = path ? `${path}/${segment}` : segment
    const cached = cache.get(path)
    if (cached) {
      current = cached
      continue
    }

    current = await current.getDirectoryHandle(segment, { create: true })
    cache.set(path, current)
  }

  return current
}
