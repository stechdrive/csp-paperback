import { renderOutputPlans } from '../engine/cell-extractor'
import { selectLayerTreeWithVisibility, selectOutputFiles } from '../store/selectors'
import type { AppStore } from '../store'
import type { OutputConfig, OutputEntry } from '../types'
import { buildOutputPlan } from './output-plan'
import { applyRevisionBorders } from './revision-border'
import type { ExportEntry } from '../types/output'
import { renderOutputFileAsync } from './output-render-queue'
import { OutputContextCache } from '../engine/output-context-cache'

/** Resolve every filename before taking the subset, without allocating output pixels. */
export function planExportEntriesFromState(
  state: AppStore,
  outputConfig: OutputConfig = state.outputConfig,
  selectedIds?: ReadonlySet<string>,
): ExportEntry[] {
  const plans = outputConfig === state.outputConfig ? selectOutputFiles(state)
    : buildOutputPlan(selectLayerTreeWithVisibility(state), state, outputConfig)
  const selected = selectedIds ? plans.filter(plan => selectedIds.has(plan.outputId)) : plans
  const contextCache = new OutputContextCache(24 * 1024 * 1024, 2, 64 * 1024 * 1024)
  return selected.map(file => ({
    path: file.path, flatName: file.flatName, sourceLayerId: file.sourceLayerId,
    sourceCellId: file.sourceCellId, processSuffixes: file.processSuffixes, prepared: file,
    createCanvas: async () => (await renderOutputFileAsync(file, state.projectSettings.processTable, outputConfig.revisionBorderEnabled, contextCache, state.clipDiagnostics)).canvas,
    releaseRenderCache: () => contextCache.clear(),
  }))
}

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
