import { extractAllEntries, extractVirtualSetEntries } from '../engine/cell-extractor'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import type { AppStore } from '../store'
import type { OutputConfig, OutputEntry } from '../types'

export function buildOutputEntriesFromState(
  state: AppStore,
  outputConfig: OutputConfig = state.outputConfig,
): OutputEntry[] {
  const tree = selectLayerTreeWithVisibility(state)

  let entries = extractAllEntries(
    tree,
    state.projectSettings,
    state.docWidth,
    state.docHeight,
    outputConfig.background,
    outputConfig.excludeAutoMarked,
    outputConfig.processSuffixPosition,
    state.xdtsData,
  )

  if (outputConfig.excludedProcessSuffixes.length > 0) {
    const excluded = new Set(outputConfig.excludedProcessSuffixes)
    entries = entries.filter(entry =>
      !entry.processSuffixes?.some(suffix => excluded.has(suffix))
    )
  }

  const virtualSetEntries = extractVirtualSetEntries(
    tree,
    state.virtualSets,
    state.docWidth,
    state.docHeight,
    outputConfig.background,
  )

  return [...entries, ...virtualSetEntries]
}
