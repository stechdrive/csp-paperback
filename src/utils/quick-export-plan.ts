export interface QuickExportFilePair {
  psdPath?: string
  xdtsPath?: string
  clipPath?: string
}

export type QuickExportJob = { sourcePath: string } & (
  | { pair: QuickExportFilePair; error?: never }
  | { pair?: never; error: string }
)

const ext = (path: string) => path.toLowerCase().split('.').pop() ?? ''

/** Keep the existing, explicitly selected single-project combinations working. */
export function resolveQuickExportFilePair(paths: string[]): QuickExportFilePair | null {
  const clips = paths.filter(path => ext(path) === 'clip')
  const psds = paths.filter(path => ext(path) === 'psd')
  const xdts = paths.filter(path => ext(path) === 'xdts')
  if (clips.length) {
    if (clips.length !== 1 || psds.length > 1 || xdts.length > 1) throw new Error('CLIPと対応PSDは、それぞれ1ファイルずつ開いてください')
    return { clipPath: clips[0], ...(psds[0] ? { psdPath: psds[0] } : {}) }
  }
  if (!psds.length && !xdts.length) return null
  if (psds.length !== 1 || xdts.length !== 1) throw new Error('CLIPをドロップしてください。従来形式ではPSDとXDTSを1つずつ同時にドロップできます')
  return { psdPath: psds[0], xdtsPath: xdts[0] }
}

function pathKey(path: string): string {
  const normalized = path.replaceAll('\\', '/')
  // Windows names are case insensitive; preserve case for POSIX paths.
  return /^[a-z]:\//i.test(normalized) || normalized.startsWith('//') ? normalized.toLowerCase() : normalized
}

/** Pair only the supplied files, never search neighboring directories for a PSD. */
export function resolveQuickExportJobs(paths: string[]): QuickExportJob[] {
  const files = [...new Set(paths)].filter(path => ['clip', 'psd', 'xdts'].includes(ext(path)))
  if (!files.length) return []
  const clips = files.filter(path => ext(path) === 'clip')
  const psds = files.filter(path => ext(path) === 'psd')
  const xdts = files.filter(path => ext(path) === 'xdts')
  if (clips.length <= 1 && psds.length <= 1 && xdts.length <= 1) {
    try {
      const pair = resolveQuickExportFilePair(files)!
      return [{ sourcePath: pair.clipPath ?? pair.xdtsPath!, pair }]
    } catch (error) {
      return [{ sourcePath: files[0], error: (error as Error).message }]
    }
  }
  const groups = new Map<string, string[]>()
  for (const file of files) {
    const key = pathKey(file).replace(/\.[^.]+$/, '')
    groups.set(key, [...(groups.get(key) ?? []), file])
  }
  return [...groups.values()].map(group => {
    const clipPaths = group.filter(path => ext(path) === 'clip')
    const psdPaths = group.filter(path => ext(path) === 'psd')
    const xdtsPaths = group.filter(path => ext(path) === 'xdts')
    const sourcePath = clipPaths[0] ?? group[0]
    if (clipPaths.length > 1 || psdPaths.length > 1 || xdtsPaths.length > 1) {
      return { sourcePath, error: `同名の入力が重複しているため対応を決められません:\n${group.join('\n')}` }
    }
    if (!clipPaths.length) {
      return { sourcePath, error: `同じフォルダ・同名のCLIPが指定されていません。複数作品の書き出しにはCLIPを含めてください:\n${group.join('\n')}` }
    }
    return { sourcePath, pair: { clipPath: clipPaths[0], ...(psdPaths[0] ? { psdPath: psdPaths[0] } : {}) } }
  })
}
