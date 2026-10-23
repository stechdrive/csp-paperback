import type { DirectoryEntry, ExportDirectory } from '../platform/export-directory'
import { appendFileNameSuffix, appendPathSegmentSuffix, outputNameKey } from './path-sanitize'
import type { PreparedOutputEntry } from './output-builder'
import type { DirectoryExportSession } from './directory-export-session'

export interface DirectoryNode {
  id: string
  displayPath: string
  name: string
  handle?: ExportDirectory
  parent?: DirectoryNode
  children?: Map<string, DirectoryEntry>
  folders: Map<string, DirectoryNode>
  segments: string[]
}
export interface DirectoryFilePlan { prepared: PreparedOutputEntry; parent: DirectoryNode; overwrite: boolean }

export function directoryNode(handle: ExportDirectory): DirectoryNode {
  return { id: handle.id, displayPath: handle.displayPath, name: '', handle, folders: new Map(), segments: [] }
}
async function children(node: DirectoryNode): Promise<Map<string, DirectoryEntry>> {
  if (!node.children) {
    node.children = new Map()
    for (const entry of node.handle ? await node.handle.list() : []) {
      const key = outputNameKey(entry.name)
      // Equivalent names on a case-sensitive volume are ambiguous overwrite targets.
      node.children.set(key, node.children.has(key) ? { ...entry, kind: 'other' } : entry)
    }
  }
  return node.children
}
function childNode(parent: DirectoryNode, name: string, handle?: ExportDirectory): DirectoryNode {
  return { id: `${parent.id}/${name}`, displayPath: handle?.displayPath ?? `${parent.displayPath}/${name}`,
    name, parent, handle, folders: new Map(), segments: [...parent.segments, name] }
}

export async function exportRoot(parent: ExportDirectory, base: string, session: DirectoryExportSession, newOnly = false): Promise<DirectoryNode> {
  const parentNode = directoryNode(parent), entries = await children(parentNode)
  for (let index = 1; index <= 10000; index++) {
    const name = index === 1 ? base : appendPathSegmentSuffix(base, `_${index}`)
    const existing = entries.get(outputNameKey(name))
    const actual = existing?.name ?? name
    if (session.roots.has(outputNameKey(`${parent.id}/${actual}`))) continue
    if (existing && (newOnly || existing.kind !== 'directory')) continue
    const root = childNode(parentNode, actual, existing ? await parent.directory(actual, false) : undefined)
    root.segments = []
    return root
  }
  throw new Error('保存先フォルダ名の競合が多すぎるため書き出しを中止しました')
}

/** Resolve existing names and file/directory conflicts without creating anything. */
export async function planDirectoryFiles(root: DirectoryNode, entries: PreparedOutputEntry[],
  previous: ReadonlySet<string>, avoidExisting = false): Promise<DirectoryFilePlan[]> {
  const used = new Set(previous)
  const planned: DirectoryFilePlan[] = []
  for (const entry of entries) {
    let parent = root
    for (const segment of entry.segments.slice(0, -1)) {
      const cached = parent.folders.get(outputNameKey(segment))
      if (cached) { parent = cached; continue }
      const existing = await children(parent)
      let folder: DirectoryNode | undefined
      for (let index = 1; index <= 10000; index++) {
        const name = index === 1 ? segment : appendPathSegmentSuffix(segment, `_${index}`)
        const item = existing.get(outputNameKey(name))
        const actual = item?.name ?? name
        if ((item && item.kind !== 'directory') || used.has(outputNameKey([...parent.segments, actual].join('/')))) continue
        // A previously planned folder can have the same physical name after a rename.
        folder = [...parent.folders.values()].find(node => outputNameKey(node.name) === outputNameKey(actual))
          ?? childNode(parent, actual, item && parent.handle ? await parent.handle.directory(actual, false) : undefined)
        existing.set(outputNameKey(actual), { name: actual, kind: 'directory' })
        parent.folders.set(outputNameKey(segment), folder)
        break
      }
      if (!folder) throw new Error('保存先のフォルダ名を確定できませんでした')
      parent = folder
    }
    const existing = await children(parent)
    let file: DirectoryFilePlan | undefined
    for (let index = 1; index <= 10000; index++) {
      const candidate = index === 1 ? entry.fileName : appendFileNameSuffix(entry.fileName, `_${index}`)
      const item = existing.get(outputNameKey(candidate))
      const name = item?.name ?? candidate
      const segments = [...parent.segments, name], relativePath = segments.join('/')
      if (used.has(outputNameKey(relativePath)) || (item && (avoidExisting || item.kind !== 'file'))) continue
      file = { parent, overwrite: item?.kind === 'file', prepared: { ...entry, fileName: name, segments, relativePath } }
      used.add(outputNameKey(relativePath))
      break
    }
    if (!file) throw new Error('保存先のファイル名を確定できませんでした')
    planned.push(file)
  }
  return planned
}

export async function materializeDirectory(node: DirectoryNode): Promise<ExportDirectory> {
  if (node.handle) return node.handle
  const parent = await materializeDirectory(node.parent!)
  node.handle = await parent.directory(node.name, true)
  return node.handle
}

export async function unusedFileName(parent: ExportDirectory, base: string, reserved: ReadonlySet<string>, segments: string[]): Promise<string> {
  const occupied = new Set((await parent.list()).map(entry => outputNameKey(entry.name)))
  for (let index = 2; index <= 10000; index++) {
    const name = appendFileNameSuffix(base, `_${index}`)
    if (!occupied.has(outputNameKey(name)) && !reserved.has(outputNameKey([...segments, name].join('/')))) return name
  }
  throw new Error('保存先のファイル名の競合が多すぎます')
}
