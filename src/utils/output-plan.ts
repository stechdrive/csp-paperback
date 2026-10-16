import { planAllEntries, planVirtualSetEntries, type PlannedOutputEntry } from '../engine/cell-extractor'
import type { AppStore } from '../store'
import type { CspLayer, OutputConfig } from '../types'
import { prepareOutputEntries, type PreparedOutputEntry } from './output-builder'
import { isOutputTargetExcluded } from './output-target'
import { createOutputRenderKey } from './output-render-key'

export type OutputFile = PlannedOutputEntry & PreparedOutputEntry & {
  /** Shared by metadata-only revisions; never use outputId alone as an image key. */
  renderKey: string
}

/** Export order matters: resolve collisions before sorting or searching the list. */
export function buildOutputPlan(
  tree: CspLayer[],
  state: Pick<AppStore, 'projectSettings' | 'docWidth' | 'docHeight' | 'virtualSets' | 'timelineData' | 'outputConfig'>,
  config: OutputConfig = state.outputConfig,
): OutputFile[] {
  const plans = [
    ...planAllEntries(tree, state.projectSettings, state.docWidth, state.docHeight,
      config.background, false, config.processSuffixPosition, state.timelineData)
      .filter(entry => !isOutputTargetExcluded(entry.outputTarget, config)),
    ...planVirtualSetEntries(tree, state.virtualSets, state.docWidth, state.docHeight, config.background),
  ]
  const names = prepareOutputEntries(plans, config)
  const renderKey = createOutputRenderKey(tree, state.docWidth, state.docHeight, config.background,
    state.virtualSets, state.projectSettings.processTable, config.revisionBorderEnabled)
  return plans.map((plan, index) => ({ ...plan, ...names[index], renderKey: renderKey(plan) }))
}
