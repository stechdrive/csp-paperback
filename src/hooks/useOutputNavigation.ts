import { useCallback } from 'react'
import { useAppStore } from '../store'
import { selectLayerTreeWithVisibility, selectOutputFiles, selectOutputNavigation } from '../store/selectors'
import { collectOutputRevealFolders } from '../utils/output-navigation'

export function useOutputNavigation() {
  const activeId = useAppStore(s => s.activeOutputId)
  const files = useAppStore(selectOutputFiles)
  const navigation = useAppStore(selectOutputNavigation)
  const currentSource = files.find(file => file.outputId === activeId)?.sourceLayerId
  const currentIdx = navigation.entries.findIndex(entry => entry.id === currentSource)
  const navigateTo = useCallback((index: number) => {
    const state = useAppStore.getState()
    const entry = selectOutputNavigation(state).entries[index]
    return entry ? state.selectOutputEntry(entry, { reveal: true }) : undefined
  }, [])
  const navigate = useCallback((direction: 1 | -1) => {
    const state = useAppStore.getState()
    const entries = selectOutputNavigation(state).entries
    const source = selectOutputFiles(state).find(file => file.outputId === state.activeOutputId)?.sourceLayerId
    const index = entries.findIndex(entry => entry.id === source)
    const next = index < 0 ? (direction > 0 ? 0 : entries.length - 1) : Math.max(0, Math.min(entries.length - 1, index + direction))
    return entries[next] ? state.selectOutputEntry(entries[next], { reveal: true }) : undefined
  }, [])
  const revealCurrent = useCallback(() => {
    const state = useAppStore.getState()
    const file = selectOutputFiles(state).find(file => file.outputId === state.activeOutputId)
    const navigation = selectOutputNavigation(state)
    const entry = navigation.entries.find(entry => entry.id === file?.sourceLayerId)
    if (entry) useAppStore.setState({ transientExpandedFolders: collectOutputRevealFolders(selectLayerTreeWithVisibility(state), navigation,
      entry.kind === 'layer' ? entry.id : null, entry.kind === 'virtualSet' ? entry.id : null) })
    return entry
  }, [])
  return { entries: navigation.entries, currentIdx, navigateTo, navigate, revealCurrent }
}
