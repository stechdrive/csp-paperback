// A sweep is one history transaction. Release/cancel/focus loss must terminate
// it even when the initiating row disappears or another panel takes focus.
export const visibilityDrag = { active: false, targetHidden: false }
export const vsVisibilityDrag = { active: false, targetVisible: true }
export function cancelLayerVisibilityDrag() { visibilityDrag.active = false }
export function cancelVirtualVisibilityDrag() { vsVisibilityDrag.active = false }
if (typeof window !== 'undefined') {
  const cancel = () => { cancelLayerVisibilityDrag(); cancelVirtualVisibilityDrag() }
  for (const event of ['mouseup', 'pointercancel', 'blur']) window.addEventListener(event, cancel)
}
