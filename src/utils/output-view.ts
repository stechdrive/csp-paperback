import { useAppStore } from '../store'

// Browsers can retarget compatibility clicks to the newly mounted view after a double tap.
let touchSwitchAt = -Infinity
export function switchOutputViewByTouch(mode: 'tiles' | 'single') {
  touchSwitchAt = performance.now()
  useAppStore.getState().setOutputViewMode(mode)
}
export const isTouchCompatibilityClick = () => performance.now() - touchSwitchAt < 450
