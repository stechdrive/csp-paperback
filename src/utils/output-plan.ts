import { planAllEntries, planVirtualSetEntries, type PlannedOutputEntry } from '../engine/cell-extractor'
import type { AppStore } from '../store'
import type { CspLayer, OutputConfig } from '../types'
import { prepareOutputEntries, type PreparedOutputEntry } from './output-builder'
import { isOutputTargetExcluded } from './output-target'
import { createOutputRenderKey } from './output-render-key'
import { createRegionPreview, type RegionPreview } from '../engine/preview-region'

export type OutputFile = PlannedOutputEntry & PreparedOutputEntry & {
  /** Shared by metadata-only revisions; never use outputId alone as an image key. */
  renderKey: string
  preview?: RegionPreview
}

/** Export order matters: resolve collisions before sorting or searching the list. */
export function buildOutputPlan(
  tree: CspLayer[],
  state: Pick<AppStore, 'projectSettings' | 'docWidth' | 'docHeight' | 'virtualSets' | 'timelineData' | 'outputConfig'> & Partial<Pick<AppStore, 'outputAliases'>>,
  config: OutputConfig = state.outputConfig,
): OutputFile[] {
  const plans = [
    ...planAllEntries(tree, state.projectSettings, state.docWidth, state.docHeight,
      config.background, false, config.processSuffixPosition, state.timelineData, state.outputAliases)
      .filter(entry => !isOutputTargetExcluded(entry.outputTarget, config)),
    ...planVirtualSetEntries(tree, state.virtualSets, state.docWidth, state.docHeight, config.background),
  ]
  const names = prepareOutputEntries(plans, config)
  const renderKey = createOutputRenderKey(tree, state.docWidth, state.docHeight, config.background,
    state.virtualSets, state.projectSettings.processTable, config.revisionBorderEnabled)
  return plans.map((plan, index) => ({ ...plan, ...names[index], renderKey: renderKey(plan),
    preview: createRegionPreview(tree, state.docWidth, state.docHeight, (regionTree, width, height) => {
      const entries = [...planAllEntries(regionTree, state.projectSettings, width, height,
        config.background, false, config.processSuffixPosition, state.timelineData),
      ...planVirtualSetEntries(regionTree, state.virtualSets, width, height, config.background)]
      const entry = entries.find(entry => entry.outputId === plan.outputId)
      if (!entry) throw new Error('表示する出力が変更されました')
      return entry.renderCanvas(new Map())
    }) }))
}
