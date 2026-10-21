import { useMemo } from 'react'
import { useAppStore } from '../store'
import { selectDraftOutputs, selectOutputFiles, selectOutputNavigation } from '../store/selectors'

export const normalizeOutputSearch = (value: string) => value.normalize('NFKC').toLocaleLowerCase()

/** The board and the list share both order and the current filename filter. */
export function useVisibleOutputs() {
  const files = useAppStore(selectOutputFiles)
  const drafts = useAppStore(selectDraftOutputs)
  const navigation = useAppStore(selectOutputNavigation)
  const search = useAppStore(s => s.outputSearch)
  return useMemo(() => {
    const bySource = new Map(files.map(file => [file.sourceLayerId, file]))
    const ordered = navigation.entries.flatMap(entry => bySource.has(entry.id) ? [bySource.get(entry.id)!] : [])
    const query = normalizeOutputSearch(search.trim())
    return [...ordered, ...drafts].filter(file => normalizeOutputSearch(file.relativePath).includes(query))
  }, [files, drafts, navigation, search])
}
