import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../store'
import { virtualSetToXmp, xmpToVirtualSet, type XmpVirtualSet } from '../utils/xmp'
import { serializeXdts } from '../utils/xdts-parser'
import { sanitizeManualAnimFolderIds } from '../utils/manual-animation-folder'
import type { CspLayer, ProjectSettings } from '../types'

interface CspbData {
  version: 1
  xdtsXml: string | null
  singleMarkNames: string[]
  virtualSets: XmpVirtualSet[]
  manualAnimFolderNames: string[]
  projectSettings: ProjectSettings
}

function flatLayers(layers: CspLayer[]): CspLayer[] {
  const result: CspLayer[] = []
  const walk = (ls: CspLayer[]) => { for (const l of ls) { result.push(l); walk(l.children) } }
  walk(layers)
  return result
}

export function useCspb() {
  const [notification, setNotification] = useState<string | null>(null)

  useEffect(() => {
    if (!notification) return
    const t = setTimeout(() => setNotification(null), 5000)
    return () => clearTimeout(t)
  }, [notification])

  const saveCspb = useCallback(() => {
    const s = useAppStore.getState()
    const flat = flatLayers(s.layerTree)
    const idToName = new Map(flat.map(l => [l.id, l.originalName]))

    const data: CspbData = {
      version: 1,
      xdtsXml: s.xdtsData ? serializeXdts(s.xdtsData, []) : null,
      singleMarkNames: Array.from(s.singleMarks.keys())
        .map(id => idToName.get(id) ?? '').filter(Boolean),
      virtualSets: s.virtualSets.map(vs => virtualSetToXmp(vs, idToName)),
      manualAnimFolderNames: Array.from(s.manualAnimFolderIds)
        .map(id => idToName.get(id) ?? '').filter(Boolean),
      projectSettings: s.projectSettings,
    }

    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const baseName = (s.psdFileName ?? 'project').replace(/\.psd$/i, '')
    a.download = `${baseName}.cspb`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const loadCspbFile = useCallback(async (file: File) => {
    const s = useAppStore.getState()
    if (s.layerTree.length === 0) {
      throw new Error('先に PSD を読み込んでください')
    }

    const text = await file.text()
    const data = JSON.parse(text) as CspbData
    if (data.version !== 1) throw new Error('非対応のバージョンです')

    // XDTS を先に適用（in-place 更新なので ID は変わらない）
    if (data.xdtsXml) {
      s.loadXdts(data.xdtsXml, file.name.replace(/\.cspb$/i, '.xdts'))
    }

    // 名前 → 現在の ID に解決
    const flat = flatLayers(useAppStore.getState().layerTree)
    const nameToId = new Map<string, string>()
    for (const l of flat) {
      if (!nameToId.has(l.originalName)) nameToId.set(l.originalName, l.id)
    }

    const singleMarks = new Map(
      data.singleMarkNames
        .map(name => nameToId.get(name))
        .filter((id): id is string => Boolean(id))
        .map(id => [id, { layerId: id, origin: 'manual' as const }]),
    )
    const virtualSets = data.virtualSets.map(xvs => xmpToVirtualSet(xvs, nameToId))
    const loadedManualAnimFolderIds = new Set(
      data.manualAnimFolderNames
        .map(name => nameToId.get(name))
        .filter((id): id is string => Boolean(id)),
    )
    const manualAnimFolderIds = sanitizeManualAnimFolderIds(
      useAppStore.getState().layerTree,
      loadedManualAnimFolderIds,
    )

    useAppStore.setState({ singleMarks, virtualSets, manualAnimFolderIds, projectSettings: data.projectSettings })

    // ズレ数を集計してトースト文字列を決定
    const unresolvedMarks = data.singleMarkNames.length - singleMarks.size
    const totalMembers = data.virtualSets.reduce((n, vs) => n + vs.members.length, 0)
    const resolvedMembers = virtualSets.reduce((n, vs) => n + vs.members.length, 0)
    const unresolvedMembers = totalMembers - resolvedMembers
    const unresolved = unresolvedMarks + unresolvedMembers

    setNotification(
      unresolved > 0
        ? `設定を読み込みました（${unresolved}個のアイテムが現在のPSDで見つかりません）`
        : '設定を読み込みました',
    )
  }, [])

  return { saveCspb, loadCspbFile, notification }
}
