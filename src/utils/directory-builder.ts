import type { OutputConfig, OutputEntry } from '../types'
import { createAbortError, isDesktopRuntime } from '../platform/runtime'
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
  return isDesktopRuntime() || typeof getDirectoryPicker() === 'function'
}

export async function saveEntriesToDirectory(
  entries: OutputEntry[],
  config: OutputConfig,
  psdFileName: string,
  dpiX = 0,
  dpiY = 0,
  onProgress?: (done: number, total: number) => void,
  defaultDirectory?: string,
): Promise<string> {
  if (isDesktopRuntime()) {
    return saveEntriesToTauriDirectory(entries, config, psdFileName, dpiX, dpiY, onProgress, defaultDirectory)
  }

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

async function saveEntriesToTauriDirectory(
  entries: OutputEntry[],
  config: OutputConfig,
  psdFileName: string,
  dpiX = 0,
  dpiY = 0,
  onProgress?: (done: number, total: number) => void,
  defaultDirectory?: string,
): Promise<string> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { writeFile } = await import('@tauri-apps/plugin-fs')
  const { join } = await import('@tauri-apps/api/path')
  const defaultPath = await makeTauriDirectoryDialogDefaultPath(defaultDirectory, psdFileName)

  const selected = await open({
    title: '書き出し先フォルダを選択',
    directory: true,
    multiple: false,
    recursive: true,
    defaultPath,
  })
  if (selected === null) throw createAbortError()

  const exportRoot = await createUniqueChildDirectoryPath(selected, makeExportBaseName(psdFileName))
  const preparedEntries = prepareOutputEntries(entries, config)
  const directoryCache = new Map<string, string>()

  for await (const entry of streamOutputEntries(
    preparedEntries,
    entries,
    config,
    dpiX,
    dpiY,
    onProgress,
  )) {
    const parentDirectory = await ensureDirectoryPathByString(
      exportRoot.path,
      entry.segments.slice(0, -1),
      directoryCache,
    )
    const filePath = await join(parentDirectory, entry.fileName)
    await writeFile(filePath, new Uint8Array(await entry.input.arrayBuffer()))
  }

  return exportRoot.name
}

async function makeTauriDirectoryDialogDefaultPath(
  defaultDirectory: string | undefined,
  psdFileName: string,
): Promise<string | undefined> {
  if (!defaultDirectory) return undefined

  const { join } = await import('@tauri-apps/api/path')
  return join(defaultDirectory, makeExportBaseName(psdFileName))
}

async function createUniqueChildDirectoryPath(
  parent: string,
  baseName: string,
): Promise<{ name: string; path: string }> {
  const { exists, mkdir } = await import('@tauri-apps/plugin-fs')
  const { join } = await import('@tauri-apps/api/path')

  for (let index = 0; index < 1000; index++) {
    const candidate = index === 0 ? baseName : `${baseName}_${index + 1}`
    const candidatePath = await join(parent, candidate)
    if (await exists(candidatePath)) continue

    try {
      await mkdir(candidatePath)
      return { name: candidate, path: candidatePath }
    } catch {
      if (await exists(candidatePath)) continue
      throw new Error(`保存先フォルダを作成できませんでした: ${candidate}`)
    }
  }

  throw new Error('保存先フォルダ名の競合が多すぎるため書き出しを中止しました')
}

async function ensureDirectoryPathByString(
  root: string,
  segments: string[],
  cache: Map<string, string>,
): Promise<string> {
  const { exists, mkdir } = await import('@tauri-apps/plugin-fs')
  const { join } = await import('@tauri-apps/api/path')
  let current = root
  let path = ''

  for (const segment of segments) {
    path = path ? `${path}/${segment}` : segment
    const cached = cache.get(path)
    if (cached) {
      current = cached
      continue
    }

    current = await join(current, segment)
    if (!await exists(current)) {
      await mkdir(current)
    }
    cache.set(path, current)
  }

  return current
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
