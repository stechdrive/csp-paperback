import { renderOutputPlans } from '../engine/cell-extractor'
import { selectLayerTreeWithVisibility, selectOutputFiles } from '../store/selectors'
import type { AppStore } from '../store'
import type { OutputConfig, OutputEntry } from '../types'
import { buildOutputPlan } from './output-plan'
import { applyRevisionBorders } from './revision-border'

export function buildOutputEntriesFromState(
  state: AppStore,
  outputConfig: OutputConfig = state.outputConfig,
): OutputEntry[] {
  const plans = outputConfig === state.outputConfig
    ? selectOutputFiles(state)
    : buildOutputPlan(selectLayerTreeWithVisibility(state), state, outputConfig)
  return applyRevisionBorders(renderOutputPlans(plans), state.projectSettings.processTable,
    outputConfig.revisionBorderEnabled)
}
