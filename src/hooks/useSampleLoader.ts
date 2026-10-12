import { loadProjectFiles } from '../utils/project-loader'
import { useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { buildC001VirtualSets } from '../sample/c001-virtual-set'

const BASE = import.meta.env.BASE_URL

export function useSampleLoader() {
  const [loading, setLoading] = useState(false)

  const loadSample = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${BASE}sample/c001.clip`)
      if (!response.ok) throw new Error('サンプルCLIPを読み込めませんでした')
      const bytes = await response.arrayBuffer()
      await loadProjectFiles([{ name: 'c001.clip', arrayBuffer: async () => bytes, text: async () => '' }])
      const virtualSets = buildC001VirtualSets(useAppStore.getState().layerTree)
      useAppStore.setState({
        virtualSets,
        selectedLayerId: null,
      })
      useAppStore.getState().setSelectedVirtualSet(virtualSets[0]?.id ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  return { loadSample, loading }
}
