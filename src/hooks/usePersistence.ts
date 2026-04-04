import { useEffect, useCallback } from 'react'
import { useAppStore } from '../store'
import { serializeToXmp, deserializeFromXmp, type PersistedState } from '../utils/xmp'
import { writePsdFile } from '../utils/psd-io'

export function usePersistence() {
  const rawPsd = useAppStore(s => s.rawPsd)
  const psdFileName = useAppStore(s => s.psdFileName)

  // PSD 読み込み後、XMP メタデータからプロジェクト状態を復元
  useEffect(() => {
    if (!rawPsd) return
    const xmp = rawPsd.imageResources?.xmpMetadata
    if (!xmp) return
    const persisted = deserializeFromXmp(xmp)
    if (!persisted) return

    useAppStore.setState({
      singleMarks: new Map(
        persisted.singleMarkIds.map(id => [id, { layerId: id, origin: 'manual' as const }])
      ),
      virtualSets: persisted.virtualSets,
      manualAnimFolderIds: new Set(persisted.manualAnimFolderIds),
      folderModes: new Map(
        Object.entries(persisted.folderModes)
      ),
      projectSettings: persisted.projectSettings,
    })
  }, [rawPsd])

  // 現在のプロジェクト状態を XMP に埋め込んで PSD をダウンロード保存
  const savePsd = useCallback(() => {
    const s = useAppStore.getState()
    if (!s.rawPsd || !s.psdFileName) return

    const persisted: PersistedState = {
      singleMarkIds: Array.from(s.singleMarks.keys()),
      virtualSets: s.virtualSets,
      manualAnimFolderIds: Array.from(s.manualAnimFolderIds),
      folderModes: Object.fromEntries(s.folderModes.entries()),
      projectSettings: s.projectSettings,
    }

    const xmpXml = serializeToXmp(persisted)
    const psdWithXmp = {
      ...s.rawPsd,
      imageResources: {
        ...s.rawPsd.imageResources,
        xmpMetadata: xmpXml,
      },
    }

    const buffer = writePsdFile(psdWithXmp)
    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = s.psdFileName
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  return { savePsd, hasPsd: !!psdFileName }
}
