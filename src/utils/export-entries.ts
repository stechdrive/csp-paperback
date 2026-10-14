import { renderOutputPlans } from '../engine/cell-extractor'
import { selectLayerTreeWithVisibility, selectOutputFiles } from '../store/selectors'
import type { AppStore } from '../store'
import type { OutputConfig, OutputEntry } from '../types'
import { buildOutputPlan } from './output-plan'
import { applyRevisionBorders } from './revision-border'

export function buildOutputEntriesFromState(
  state: AppStore,
  outputConfig: OutputConfig = state.outputConfig,
  selectedIds?: ReadonlySet<string>,
): OutputEntry[] {
  const plans = outputConfig === state.outputConfig
    ? selectOutputFiles(state)
    : buildOutputPlan(selectLayerTreeWithVisibility(state), state, outputConfig)
  const selected = selectedIds ? plans.filter(plan => selectedIds.has(plan.outputId)) : plans
  return applyRevisionBorders(renderOutputPlans(selected), state.projectSettings.processTable,
    outputConfig.revisionBorderEnabled).map((entry, index) => ({ ...entry, prepared: selected[index] }))
}
