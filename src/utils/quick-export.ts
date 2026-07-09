import { useAppStore } from '../store'
import { allowTauriLaunchFilePaths, loadableFilesFromPaths, type LoadableFile } from '../platform/files'
import { buildOutputEntriesFromState } from './export-entries'
import { saveEntriesToDirectoryPath } from './directory-builder'

export interface QuickExportFilePair {
  psdPath: string
  xdtsPath: string
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

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}

function findFile(files: LoadableFile[], path: string): LoadableFile {
  const name = fileNameFromPath(path)
  const file = files.find(candidate => candidate.name === name)
  if (!file) throw new Error(`ファイルを読み込めませんでした: ${name}`)
  return file
}

export function resolveQuickExportFilePair(paths: string[]): QuickExportFilePair | null {
  const psdPaths = paths.filter(path => ext(path) === 'psd')
  const xdtsPaths = paths.filter(path => ext(path) === 'xdts')

  if (psdPaths.length === 0 && xdtsPaths.length === 0) return null
  if (psdPaths.length !== 1 || xdtsPaths.length !== 1) {
    throw new Error('クイック書き出しにはPSDとXDTSを1つずつ同時にドロップしてください')
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
    throw new Error('クイック書き出し用のPSD/XDTSが見つかりませんでした')
  }

  onProgress({ progress: 0.05, message: 'ファイルを確認しています' })

  const { dirname } = await import('@tauri-apps/api/path')
  const xdtsDirectory = await dirname(pair.xdtsPath)
  await allowTauriLaunchFilePaths()

  const files = await loadableFilesFromPaths([pair.xdtsPath, pair.psdPath])
  const xdtsFile = findFile(files, pair.xdtsPath)
  const psdFile = findFile(files, pair.psdPath)
  const store = useAppStore.getState()

  store.resetProject()
  onProgress({ progress: 0.12, message: 'XDTSを読み込んでいます' })
  store.loadXdts(await xdtsFile.text(), xdtsFile.name, xdtsFile.sourceDirectory)
  onProgress({ progress: 0.24, message: 'PSDを解析しています' })
  store.loadPsd(await psdFile.arrayBuffer(), psdFile.name, psdFile.sourceDirectory)

  const loadedState = useAppStore.getState()
  if (!loadedState.psdFileName || loadedState.docWidth === 0) {
    throw new Error('PSDファイルが読み込まれていません')
  }
  if (!loadedState.xdtsData) {
    throw new Error('XDTSファイルが読み込まれていません')
  }

  onProgress({ progress: 0.38, message: '出力画像を合成しています' })
  const outputConfig = loadedState.quickExportConfig
  const entries = buildOutputEntriesFromState(loadedState, outputConfig)
  if (entries.length === 0) {
    throw new Error('出力対象がありません')
  }

  onProgress({ progress: 0.5, message: 'XDTSフォルダへ書き出しています' })
  const outputDirectory = await saveEntriesToDirectoryPath(
    entries,
    outputConfig,
    loadedState.psdFileName,
    xdtsDirectory,
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
