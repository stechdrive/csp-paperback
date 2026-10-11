import { loadProjectFiles } from './project-loader'
import { useAppStore } from '../store'
import { allowTauriLaunchFilePaths, loadableFilesFromPaths } from '../platform/files'
import { buildOutputEntriesFromState } from './export-entries'
import { saveEntriesToDirectoryPath } from './directory-builder'

export interface QuickExportFilePair {
  psdPath?: string
  xdtsPath?: string
  clipPath?: string
}

export interface QuickExportProgress {
  progress: number
  message: string
}

export interface QuickExportResult {
  outputDirectory: string
  entryCount: number
}

function ext(path: string): string {
  return path.toLowerCase().split('.').pop() ?? ''
}

export function resolveQuickExportFilePair(paths: string[]): QuickExportFilePair | null {
  const clipPaths = paths.filter(path => ext(path) === 'clip')
  const psdPaths = paths.filter(path => ext(path) === 'psd')
  const xdtsPaths = paths.filter(path => ext(path) === 'xdts')

  if (clipPaths.length) {
    if (clipPaths.length !== 1 || psdPaths.length > 1 || xdtsPaths.length > 1) throw new Error('CLIPと対応PSDは、それぞれ1ファイルずつ開いてください')
    return { clipPath: clipPaths[0], ...(psdPaths[0] ? { psdPath: psdPaths[0] } : {}) }
  }
  if (psdPaths.length === 0 && xdtsPaths.length === 0) return null
  if (psdPaths.length !== 1 || xdtsPaths.length !== 1) {
    throw new Error('CLIPをドロップしてください。従来形式ではPSDとXDTSを1つずつ同時にドロップできます')
  }

  return {
    psdPath: psdPaths[0],
    xdtsPath: xdtsPaths[0],
  }
}

export async function runQuickExport(
  paths: string[],
  onProgress: (progress: QuickExportProgress) => void,
): Promise<QuickExportResult> {
  const pair = resolveQuickExportFilePair(paths)
  if (!pair) {
    throw new Error('クイック書き出し用のCLIPまたはPSD＋XDTSが見つかりませんでした')
  }

  onProgress({ progress: 0.05, message: 'ファイルを確認しています' })

  const { dirname } = await import('@tauri-apps/api/path')
  const outputParent = await dirname(pair.clipPath ?? pair.xdtsPath!)
  await allowTauriLaunchFilePaths()

  const files = await loadableFilesFromPaths([pair.clipPath, pair.xdtsPath, pair.psdPath].filter((p): p is string => !!p))
  onProgress({ progress: 0.12, message: '素材とタイムラインを読み込んでいます' })
  await loadProjectFiles(files)
  const loadedState = useAppStore.getState()
  const sourceName = loadedState.clipFileName ?? loadedState.psdFileName
  if (!sourceName || loadedState.docWidth === 0) throw new Error('素材ファイルが読み込まれていません')

  onProgress({ progress: 0.38, message: '出力画像を合成しています' })
  const outputConfig = loadedState.savedOutputConfig
  const entries = buildOutputEntriesFromState(loadedState, outputConfig)
  if (entries.length === 0) {
    throw new Error('出力対象がありません')
  }

  onProgress({ progress: 0.5, message: '入力ファイルと同じ場所へ書き出しています' })
  const outputDirectory = await saveEntriesToDirectoryPath(
    entries,
    outputConfig,
    sourceName,
    outputParent,
    loadedState.docDpiX,
    loadedState.docDpiY,
    (done, total) => {
      onProgress({
        progress: 0.5 + 0.45 * (done / total),
        message: `書き出し中 ${done}/${total}`,
      })
    },
  )

  onProgress({ progress: 1, message: '完了しました' })

  return {
    outputDirectory,
    entryCount: entries.length,
  }
}
