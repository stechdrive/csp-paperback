import type { OutputConfig, ExportEntry, ExportProgressCallback, DirectoryExportMode } from '../types/output'
import { createAbortError, isDesktopRuntime } from '../platform/runtime'
import { browserExportDirectory, nativeExportDirectory, DestinationExistsError, type ExportDirectory } from '../platform/export-directory'
import { makeExportBaseName, prepareOutputEntries, streamOutputEntries } from './output-builder'
import { DirectoryExportSession } from './directory-export-session'
import { directoryNode, exportRoot, materializeDirectory, planDirectoryFiles, unusedFileName } from './directory-export-plan'
import { outputNameKey } from './path-sanitize'

type ShowDirectoryPicker = (options?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
function getDirectoryPicker(): ShowDirectoryPicker | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as { showDirectoryPicker?: ShowDirectoryPicker }).showDirectoryPicker
}
export function supportsDirectoryExport(): boolean {
  return isDesktopRuntime() || typeof getDirectoryPicker() === 'function'
}
export interface DirectoryExportOptions { mode?: DirectoryExportMode; session?: DirectoryExportSession }

export async function saveEntriesToDirectory(entries: ExportEntry[], config: OutputConfig, sourceName: string,
  dpiX = 0, dpiY = 0, onProgress?: ExportProgressCallback, defaultDirectory?: string, options: DirectoryExportOptions = {}): Promise<string> {
  let parent: ExportDirectory
  if (isDesktopRuntime()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ title: '書き出し先フォルダを選択', directory: true, multiple: false,
      recursive: true, defaultPath: defaultDirectory })
    if (selected === null) throw createAbortError()
    parent = nativeExportDirectory(selected)
  } else {
    const picker = getDirectoryPicker()
    if (!picker) throw new Error('このブラウザではフォルダ書き出しに対応していません')
    parent = browserExportDirectory(await picker({ id: 'csp-paperback-export', mode: 'readwrite' }))
  }
  return saveToDirectory(parent, entries, config, sourceName, dpiX, dpiY, onProgress, options)
}

export async function saveEntriesToDirectoryPath(entries: ExportEntry[], config: OutputConfig, sourceName: string,
  parentDirectory: string, dpiX = 0, dpiY = 0, onProgress?: ExportProgressCallback, options: DirectoryExportOptions = {}): Promise<string> {
  if (!isDesktopRuntime()) throw new Error('クイック書き出しはデスクトップ版でのみ利用できます')
  return saveToDirectory(nativeExportDirectory(parentDirectory), entries, config, sourceName, dpiX, dpiY, onProgress, options)
}

export async function saveToDirectory(parent: ExportDirectory, entries: ExportEntry[], config: OutputConfig, sourceName: string,
  dpiX = 0, dpiY = 0, onProgress?: ExportProgressCallback, options: DirectoryExportOptions = {}): Promise<string> {
  const mode = options.mode ?? 'subfolder', session = options.session ?? new DirectoryExportSession()
  const effectiveConfig = mode === 'direct-flat' ? { ...config, structure: 'flat' as const } : config
  const prepared = prepareOutputEntries(entries, effectiveConfig).map(entry => {
    if (mode !== 'direct-flat') return entry
    // Prepared names retain complete-plan collision numbering for subset exports.
    const fileName = entry.names.flatName
    return { ...entry, fileName, segments: [fileName], relativePath: fileName }
  })
  let root = mode === 'direct-flat' ? directoryNode(parent) : await exportRoot(parent, makeExportBaseName(sourceName), session)
  let previous = session.files.get(outputNameKey(root.id)) ?? new Set<string>()
  let plan = await planDirectoryFiles(root, prepared, previous)
  const overwriteCount = plan.filter(file => file.overwrite).length
  if (overwriteCount) {
    const answer = await session.decide({ directory: root.displayPath, mode, overwriteCount, newCount: plan.length - overwriteCount })
    if (answer.action === 'cancel') throw createAbortError()
    if (answer.action === 'rename') {
      if (mode === 'subfolder') {
        root = await exportRoot(parent, makeExportBaseName(sourceName), session, true)
        previous = session.files.get(outputNameKey(root.id)) ?? new Set<string>()
      } else {
        root = directoryNode(parent)
      }
      plan = await planDirectoryFiles(root, prepared, previous, true)
    }
  }
  const reserved = new Set([...previous, ...plan.map(file => outputNameKey(file.prepared.relativePath))])
  session.files.set(outputNameKey(root.id), reserved)
  session.roots.add(outputNameKey(root.id))
  await materializeDirectory(root)
  const filesByPath = new Map(plan.map((file, index) => [file.prepared.relativePath, { file, index }]))
  for await (const entry of streamOutputEntries(plan.map(file => file.prepared), entries, effectiveConfig, dpiX, dpiY, onProgress)) {
    const { file, index } = filesByPath.get(entry.relativePath)!
    const directory = await materializeDirectory(file.parent)
    let name = entry.fileName
    for (let attempt = 0; ; attempt++) {
      try {
        await directory.write(name, entry.input, file.overwrite)
        break
      } catch (error) {
        if (!(error instanceof DestinationExistsError) || file.overwrite || attempt >= 100) throw error
        name = await unusedFileName(directory, entry.fileName, reserved, file.parent.segments)
        const relativePath = [...file.parent.segments, name].join('/')
        reserved.add(outputNameKey(relativePath))
        onProgress?.(index, plan.length, { phase: 'writing', path: relativePath })
      }
    }
  }
  return (await materializeDirectory(root)).displayPath
}
