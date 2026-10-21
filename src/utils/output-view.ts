import { useAppStore } from '../store'
import type { OutputFile } from './output-plan'

/** Resolve the current list before entering single view, including stale/cleared selections. */
export function showOutputView(mode: 'tiles' | 'single', files: OutputFile[]) {
  const state = useAppStore.getState()
  if (mode === 'single') {
    const selected = files.filter(file => state.selectedOutputIds.has(file.outputId))
    const target = selected.find(file => file.outputId === state.activeOutputId) ?? selected[0] ?? files[0]
    if (target) {
      if (target.outputId !== state.activeOutputId || !state.selectedOutputIds.has(target.outputId)) state.selectOutputFile(target.outputId)
    } else useAppStore.setState({ activeOutputId: null, activeOutputLabel: '' })
  }
  state.setOutputViewMode(mode)
}

// Browsers can retarget compatibility clicks to the newly mounted view after a double tap.
let touchSwitchAt = -Infinity
export function switchOutputViewByTouch(mode: 'tiles' | 'single') {
  touchSwitchAt = performance.now()
  useAppStore.getState().setOutputViewMode(mode)
}
export const isTouchCompatibilityClick = () => performance.now() - touchSwitchAt < 450
