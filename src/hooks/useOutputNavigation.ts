import { useCallback, useMemo } from 'react'
import { useAppStore } from '../store'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import { collectOutputNavigation, findOutputNavigationIndex, nextOutputNavigationIndex } from '../utils/output-navigation'

/** Shared final-image navigation for the layer tree and mobile seek bar. */
export function useOutputNavigation() {
  const tree = useAppStore(selectLayerTreeWithVisibility)
  const projectSettings = useAppStore(s => s.projectSettings)
  const outputConfig = useAppStore(s => s.outputConfig)
  const virtualSets = useAppStore(s => s.virtualSets)
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const navigation = useMemo(() => collectOutputNavigation(tree, projectSettings, outputConfig, virtualSets),
    [tree, projectSettings, outputConfig, virtualSets])
  const currentIdx = findOutputNavigationIndex(navigation.entries, selectedLayerId, selectedVirtualSetId)

  const navigateTo = useCallback((index: number) => {
    const entry = navigation.entries[index]
    if (!entry) return
    const state = useAppStore.getState()
    if (entry.kind === 'virtualSet') {
      state.setSelectedVirtualSet(entry.id)
    } else {
      if (entry.animFolderId !== undefined && entry.cellIndex !== undefined) {
        state.selectAnimCell(entry.animFolderId, entry.cellIndex)
      }
      state.selectLayer(entry.id)
      // Selecting the source row with no folder focus shows precisely this image.
      state.setFocusedAnimFolder(null)
    }
    return entry
  }, [navigation])

  const navigate = useCallback((direction: 1 | -1) => {
    const state = useAppStore.getState()
    return navigateTo(nextOutputNavigationIndex(navigation, state.selectedLayerId, state.selectedVirtualSetId, direction))
  }, [navigation, navigateTo])

  return { entries: navigation.entries, currentIdx, navigateTo, navigate }
}
