import { useAppStore } from '../store'
import type { LoadableFile } from '../platform/files'
import { readClipFile } from './clip-io'
import { readPsdFile } from './psd-io'

const ext = (file: LoadableFile) => file.name.toLowerCase().split('.').pop() ?? ''

/** Shared entry point for picker, drag/drop, samples and desktop quick export. */
export async function loadProjectFiles(files: LoadableFile[]): Promise<string | null> {
  const { loadPsd, loadXdts, resetProject, importSettings } = useAppStore.getState()
  const jsonFiles = files.filter(f => ext(f) === 'json')
  const psdFile = files.filter(f => ext(f) === 'psd').at(-1)
  const xdtsFile = files.filter(f => ext(f) === 'xdts').at(-1)
  const clipFiles = files.filter(f => ext(f) === 'clip')
  const clipFile = clipFiles[0]
  if (clipFiles.length > 1 || (clipFile && files.filter(f => ext(f) === 'psd').length > 1)) {
    throw new Error('CLIPと対応PSDは、それぞれ1ファイルずつ開いてください')
  }
  const hasProjectFile = Boolean(psdFile || xdtsFile)
  const state = useAppStore.getState()
  if (clipFile) {
    const basename = (name: string) => name.replace(/\.[^.]+$/, '').toLowerCase()
    const existingPsd = !psdFile && state.rawPsd && state.psdFileName && basename(state.psdFileName) === basename(clipFile.name)
      ? { psd: state.rawPsd, name: state.psdFileName, sourceDirectory: state.psdSourceDirectory ?? undefined }
      : undefined
    const clip = await readClipFile(await clipFile.arrayBuffer(), !psdFile && !existingPsd)
    const source = psdFile ? { psd: readPsdFile(await psdFile.arrayBuffer()), name: psdFile.name, sourceDirectory: psdFile.sourceDirectory } : existingPsd
    for (const file of jsonFiles) importSettings(await file.text())
    useAppStore.getState().loadClip(clip, clipFile.name, clipFile.sourceDirectory, source)
    // Native timeline identity always takes precedence over a supplied XDTS.
    return null
  }
  if (state.clipDocument && psdFile && !xdtsFile) {
    // Validate a replacement before touching the existing CLIP project.
    loadPsd(await psdFile.arrayBuffer(), psdFile.name, psdFile.sourceDirectory)
    for (const file of jsonFiles) importSettings(await file.text())
    return 'PSDの画像に切り替えました'
  }
  if (state.clipDocument && xdtsFile && !psdFile) {
    return null
  }
  const shouldResetProject = hasProjectFile && (
    Boolean(psdFile && xdtsFile) ||
    Boolean(psdFile && state.rawPsd) ||
    Boolean(xdtsFile && state.timelineData) ||
    Boolean((psdFile || xdtsFile) && state.rawPsd && state.timelineData)
  )

  if (shouldResetProject) resetProject()

  for (const file of jsonFiles) {
    importSettings(await file.text())
  }

  // XDTS を先に保持してから PSD を解析する。PSD 側の XDTS 検出を一度で確定させるため。
  if (xdtsFile) loadXdts(await xdtsFile.text(), xdtsFile.name, xdtsFile.sourceDirectory)
  if (psdFile) loadPsd(await psdFile.arrayBuffer(), psdFile.name, psdFile.sourceDirectory)
  return null
}
