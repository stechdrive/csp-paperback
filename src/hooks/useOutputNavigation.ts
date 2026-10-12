import { useCallback } from 'react'
import { useAppStore } from '../store'
import { selectOutputNavigation } from '../store/selectors'
import { findOutputNavigationIndex, nextOutputNavigationIndex } from '../utils/output-navigation'

/** Shared final-image navigation for the layer tree and mobile seek bar. */
export function useOutputNavigation() {
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const selectedVirtualSetId = useAppStore(s => s.selectedVirtualSetId)
  const navigation = useAppStore(selectOutputNavigation)
  const currentIdx = findOutputNavigationIndex(navigation.entries, selectedLayerId, selectedVirtualSetId)

  const navigateTo = useCallback((index: number) => {
    const state = useAppStore.getState()
    const entry = selectOutputNavigation(state).entries[index]
    return entry ? state.selectOutputEntry(entry) : undefined
  }, [])

  const navigate = useCallback((direction: 1 | -1) => {
    const state = useAppStore.getState()
    const currentNavigation = selectOutputNavigation(state)
    const index = nextOutputNavigationIndex(currentNavigation, state.selectedLayerId, state.selectedVirtualSetId, direction)
    const entry = currentNavigation.entries[index]
    return entry ? state.selectOutputEntry(entry) : undefined
  }, [])

  const revealCurrent = useCallback(() => {
    const state = useAppStore.getState()
    const entries = selectOutputNavigation(state).entries
    const index = findOutputNavigationIndex(entries, state.selectedOutputSourceId ?? state.selectedLayerId, state.selectedVirtualSetId)
    const entry = entries[index]
    return entry ? state.selectOutputEntry(entry, { preserveTimeline: true }) : undefined
  }, [])

  return { entries: navigation.entries, currentIdx, navigateTo, navigate, revealCurrent }
}
