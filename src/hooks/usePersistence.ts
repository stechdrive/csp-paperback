import { useEffect, useCallback } from 'react'
import { useAppStore } from '../store'
import {
  serializeToXmp,
  deserializeFromXmp,
  virtualSetToXmp,
  xmpToVirtualSet,
  type PersistedState,
} from '../utils/xmp'
import { writePsdFile } from '../utils/psd-io'
import {
  injectMarkerLayers,
  extractMarkerLayerState,
  resolveMarkerState,
} from '../utils/marker-layers'
import { sanitizeManualAnimFolderIds } from '../utils/manual-animation-folder'
import type { CspLayer } from '../types'

/** レイヤーツリーをフラット化して id↔originalName のマップを作る */
function buildIdNameMaps(layerTree: CspLayer[]): {
  idToName: Map<string, string>
  nameToId: Map<string, string>
} {
  const idToName = new Map<string, string>()
  const nameToId = new Map<string, string>()
  const walk = (layers: CspLayer[]) => {
    for (const l of layers) {
      idToName.set(l.id, l.originalName)
      // 同名レイヤーが複数ある場合は先に現れたものを優先
      if (!nameToId.has(l.originalName)) nameToId.set(l.originalName, l.id)
      walk(l.children)
    }
  }
  walk(layerTree)
  return { idToName, nameToId }
}

export function usePersistence() {
  const rawPsd = useAppStore(s => s.rawPsd)
  const psdFileName = useAppStore(s => s.psdFileName)

  // PSD 読み込み後: XMP（V2 名前ベース）から状態を復元、なければマーカーレイヤーから復元
  useEffect(() => {
    if (!rawPsd) return

    const layerTree = useAppStore.getState().layerTree
    const { nameToId } = buildIdNameMaps(layerTree)

    const xmp = rawPsd.imageResources?.xmpMetadata
    if (xmp) {
      const persisted = deserializeFromXmp(xmp)
      if (persisted) {
        // V2: 名前 → 現在のID に解決して復元
        const singleMarks = new Map(
          persisted.singleMarkNames
            .map(name => nameToId.get(name))
            .filter((id): id is string => Boolean(id))
            .map(id => [id, { layerId: id, origin: 'manual' as const }]),
        )
        const virtualSets = persisted.virtualSets.map(xvs => xmpToVirtualSet(xvs, nameToId))
        const loadedManualAnimFolderIds = new Set(
          persisted.manualAnimFolderNames
            .map(name => nameToId.get(name))
            .filter((id): id is string => Boolean(id)),
        )
        const manualAnimFolderIds = sanitizeManualAnimFolderIds(layerTree, loadedManualAnimFolderIds)

        useAppStore.setState({
          singleMarks,
          virtualSets,
          manualAnimFolderIds,
          projectSettings: persisted.projectSettings,
        })
        return
      }
      // V1（旧UUID形式）は null が返る → マーカーレイヤーにフォールバック
    }

    // フォールバック: マーカーレイヤー（SMARK_/VSET_）から名前ベースで復元
    if (rawPsd.children && rawPsd.children.length > 0) {
      const markerState = extractMarkerLayerState(rawPsd.children)
      const hasAny =
        markerState.markedLayerNames.length > 0 || markerState.virtualSetDefs.length > 0
      if (hasAny) {
        const { singleMarks, virtualSets } = resolveMarkerState(markerState, layerTree)
        if (singleMarks.size > 0 || virtualSets.length > 0) {
          useAppStore.setState({ singleMarks, virtualSets })
        }
      }
    }
  }, [rawPsd])

  // 現在のプロジェクト状態を XMP（名前ベース V2）＋マーカーレイヤーに書き込んで PSD をダウンロード保存
  const savePsd = useCallback(() => {
    const s = useAppStore.getState()
    if (!s.rawPsd || !s.psdFileName) return

    const { idToName } = buildIdNameMaps(s.layerTree)

    const persisted: PersistedState = {
      version: 2,
      singleMarkNames: Array.from(s.singleMarks.keys())
        .map(id => idToName.get(id) ?? '')
        .filter(Boolean),
      virtualSets: s.virtualSets.map(vs => virtualSetToXmp(vs, idToName)),
      manualAnimFolderNames: Array.from(s.manualAnimFolderIds)
        .map(id => idToName.get(id) ?? '')
        .filter(Boolean),
      projectSettings: s.projectSettings,
    }

    const xmpXml = serializeToXmp(persisted)

    const rootChildren = injectMarkerLayers(
      s.rawPsd.children ?? [],
      Array.from(s.singleMarks.keys()),  // injectMarkerLayers は UUID を受け取って内部で名前変換する
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
