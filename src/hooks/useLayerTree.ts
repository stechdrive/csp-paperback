import { useCallback } from 'react'
import { useAppStore } from '../store'
import { selectLayerTreeWithVisibility, selectLayerById } from '../store/selectors'
import type { CspLayer } from '../types'

export interface UseLayerTreeResult {
  tree: CspLayer[]
  selectedLayerId: string | null
  selectLayer: (id: string | null) => void
  toggleVisibility: (id: string) => void
  toggleExpanded: (id: string) => void
  resetVisibility: () => void
  setAnimationFolder: (id: string) => void
  isAnimationFolder: (id: string) => boolean
  getLayer: (id: string) => CspLayer | null
}

export function useLayerTree(): UseLayerTreeResult {
  const tree = useAppStore(selectLayerTreeWithVisibility)
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const manualAnimFolderIds = useAppStore(s => s.manualAnimFolderIds)

  const selectLayer = useAppStore(s => s.selectLayer)
  const toggleLayerVisibility = useAppStore(s => s.toggleLayerVisibility)
  const toggleFolderExpanded = useAppStore(s => s.toggleFolderExpanded)
  const resetVisibility = useAppStore(s => s.resetVisibility)
  const toggleManualAnimFolder = useAppStore(s => s.toggleManualAnimFolder)

  const isAnimationFolder = useCallback((id: string) => {
    const layer = selectLayerById(useAppStore.getState(), id)
    return (layer?.isAnimationFolder ?? false) || !!(layer?.isFolder && manualAnimFolderIds.has(id))
  }, [manualAnimFolderIds])

  const getLayer = useCallback((id: string) => {
    return selectLayerById(useAppStore.getState(), id)
  }, [])

  return {
    tree,
    selectedLayerId,
    selectLayer,
    toggleVisibility: toggleLayerVisibility,
    toggleExpanded: toggleFolderExpanded,
    resetVisibility,
    setAnimationFolder: toggleManualAnimFolder,
    isAnimationFolder,
    getLayer,
  }
}
