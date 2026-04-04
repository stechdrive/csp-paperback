import { useEffect, useCallback } from 'react'
import { useAppStore } from '../store'
import { serializeToXmp, deserializeFromXmp, type PersistedState } from '../utils/xmp'
import { writePsdFile } from '../utils/psd-io'
import {
  injectMarkerLayers,
  extractMarkerLayerState,
  resolveMarkerState,
} from '../utils/marker-layers'

export function usePersistence() {
  const rawPsd = useAppStore(s => s.rawPsd)
  const psdFileName = useAppStore(s => s.psdFileName)

  // PSD 読み込み後: XMP から状態を復元、なければマーカーレイヤーから復元
  useEffect(() => {
    if (!rawPsd) return

    const xmp = rawPsd.imageResources?.xmpMetadata
    if (xmp) {
      const persisted = deserializeFromXmp(xmp)
      if (persisted) {
        useAppStore.setState({
          singleMarks: new Map(
            persisted.singleMarkIds.map(id => [id, { layerId: id, origin: 'manual' as const }])
          ),
          virtualSets: persisted.virtualSets,
          manualAnimFolderIds: new Set(persisted.manualAnimFolderIds),
          projectSettings: persisted.projectSettings,
        })
        return
      }
    }

    // XMP がない場合のフォールバック: マーカーレイヤーから復元
    if (rawPsd.children && rawPsd.children.length > 0) {
      const markerState = extractMarkerLayerState(rawPsd.children)
      const hasAny =
        markerState.markedLayerNames.length > 0 || markerState.virtualSetDefs.length > 0
      if (hasAny) {
        const layerTree = useAppStore.getState().layerTree
        const { singleMarks, virtualSets } = resolveMarkerState(markerState, layerTree)
        if (singleMarks.size > 0 || virtualSets.length > 0) {
          useAppStore.setState({ singleMarks, virtualSets })
        }
      }
    }
  }, [rawPsd])

  // 現在のプロジェクト状態を XMP + マーカーレイヤーに書き込んで PSD をダウンロード保存
  const savePsd = useCallback(() => {
    const s = useAppStore.getState()
    if (!s.rawPsd || !s.psdFileName) return

    const persisted: PersistedState = {
      singleMarkIds: Array.from(s.singleMarks.keys()),
      virtualSets: s.virtualSets,
      manualAnimFolderIds: Array.from(s.manualAnimFolderIds),
      projectSettings: s.projectSettings,
    }

    const xmpXml = serializeToXmp(persisted)

    const rootChildren = injectMarkerLayers(
      s.rawPsd.children ?? [],
      persisted.singleMarkIds,
      s.virtualSets,
      s.layerTree,
    )

    const psdWithXmp = {
      ...s.rawPsd,
      children: rootChildren,
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
