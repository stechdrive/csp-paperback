import { planAllEntries, planVirtualSetEntries, type PlannedOutputEntry } from '../engine/cell-extractor'
import type { AppStore } from '../store'
import type { CspLayer, OutputConfig } from '../types'
import { prepareOutputEntries, type PreparedOutputEntry } from './output-builder'

export type OutputFile = PlannedOutputEntry & PreparedOutputEntry

/** Export order matters: resolve collisions before sorting or searching the list. */
export function buildOutputPlan(
  tree: CspLayer[],
  state: Pick<AppStore, 'projectSettings' | 'docWidth' | 'docHeight' | 'virtualSets' | 'timelineData' | 'outputConfig'>,
  config: OutputConfig = state.outputConfig,
): OutputFile[] {
  const excluded = new Set(config.excludedProcessSuffixes)
  const plans = [
    ...planAllEntries(tree, state.projectSettings, state.docWidth, state.docHeight,
      config.background, config.excludeAutoMarked, config.processSuffixPosition, state.timelineData)
      .filter(entry => !entry.processSuffixes?.some(suffix => excluded.has(suffix))),
    ...planVirtualSetEntries(tree, state.virtualSets, state.docWidth, state.docHeight, config.background),
  ]
  const names = prepareOutputEntries(plans, config)
  return plans.map((plan, index) => ({ ...plan, ...names[index] }))
}
