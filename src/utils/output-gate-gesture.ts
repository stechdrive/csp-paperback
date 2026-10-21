import { useAppStore } from '../store'
import { selectOutputFiles } from '../store/selectors'
import type { OutputFile } from './output-plan'

type Point = { x: number; y: number }
export interface OutputGateRect { id: string; left: number; top: number; width: number; height: number }

/** Include controls crossed between pointer events, even during a fast sweep. */
export function crossedOutputGates(from: Point, to: Point, gates: OutputGateRect[]): string[] {
  return gates.filter(rect => {
    let enter = 0, leave = 1
    for (const [start, end, min, max] of [
      [from.x, to.x, rect.left, rect.left + rect.width],
      [from.y, to.y, rect.top, rect.top + rect.height],
    ]) {
      if (start === end) { if (start < min || start > max) return false }
      else {
        const a = (min - start) / (end - start), b = (max - start) / (end - start)
        enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b))
        if (enter > leave) return false
      }
    }
    return rect.width > 0 && rect.height > 0
  }).map(rect => rect.id)
}

/** A selected control changes the whole selection; an unselected one changes only itself. */
function startChange(file: OutputFile) {
  const state = useAppStore.getState(), enabled = state.outputExclusions.has(file.gateId)
  const ids = state.selectedOutputIds.has(file.outputId) ? new Set(state.selectedOutputIds) : new Set([file.outputId])
  state.setOutputsEnabled(ids, enabled)
  const started = useAppStore.getState()
  return {
    past: started._past, future: started._future, files: selectOutputFiles(started),
    apply(next: string[]) {
      const added = new Set(next.filter(id => !ids.has(id)))
      if (!added.size) return
      added.forEach(id => ids.add(id))
      useAppStore.getState().setOutputsEnabled(added, enabled, { recordHistory: false })
    },
  }
}

/** Shared by real list buttons and the board's drawn controls. One stroke is one undo step. */
export function mountOutputGateGesture(element: HTMLElement, files: OutputFile[],
  getRects = (): OutputGateRect[] => {
    const viewport = element.getBoundingClientRect()
    return [...element.querySelectorAll<HTMLElement>('[data-output-gate]')].map(button => {
      const rect = button.getBoundingClientRect()
      const left = Math.max(rect.left, viewport.left), top = Math.max(rect.top, viewport.top)
      return { id: button.dataset.outputGate!, left, top,
        width: Math.min(rect.right, viewport.right) - left, height: Math.min(rect.bottom, viewport.bottom) - top }
    })
  },
) {
  const byId = new Map(files.map(file => [file.outputId, file]))
  let stroke: { pointerId: number; point: Point; change: ReturnType<typeof startChange> } | undefined
  let suppressClick = false
  const point = (event: PointerEvent) => ({ x: event.clientX, y: event.clientY })
  const buttonFor = (event: Event) => event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-output-gate]') : null
  const finish = () => {
    const ended = stroke; stroke = undefined
    if (ended && element.hasPointerCapture(ended.pointerId)) element.releasePointerCapture(ended.pointerId)
  }
  const down = (event: PointerEvent) => {
    if (stroke) return
    suppressClick = false
    if (event.button !== 0 || !event.isPrimary) return
    const button = buttonFor(event), at = point(event)
    // Canvas controls are also hittable on the first touch, before any hover event.
    const id = button?.dataset.outputGate ?? crossedOutputGates(at, at, getRects())[0]
    const file = id ? byId.get(id) : undefined
    if (!file || (event.target instanceof Element && event.target.closest('button') && !button)) return
    event.preventDefault()
    // Preventing pointerdown keeps focus-visible's prior keyboard state in some browsers.
    element.dataset.outputGatePointerFocus = 'true'
    ;(button ?? element).focus({ preventScroll: true })
    element.setPointerCapture(event.pointerId)
    suppressClick = true
    stroke = { pointerId: event.pointerId, point: at, change: startChange(file) }
  }
  const move = (event: PointerEvent) => {
    if (!stroke || stroke.pointerId !== event.pointerId) return
    if (!(event.buttons & 1)) { finish(); return }
    event.preventDefault()
    const at = point(event)
    stroke.change.apply(crossedOutputGates(stroke.point, at, getRects()))
    if (stroke) stroke.point = at
  }
  const up = (event: PointerEvent) => {
    if (stroke?.pointerId === event.pointerId) finish()
  }
  const anotherPointer = (event: PointerEvent) => {
    if (stroke && event.pointerId !== stroke.pointerId) finish()
  }
  const click = (event: MouseEvent) => {
    if (suppressClick && event.detail > 0) {
      suppressClick = false; event.preventDefault(); event.stopPropagation(); return
    }
    const id = buttonFor(event)?.dataset.outputGate, file = id ? byId.get(id) : undefined
    if (file) { event.stopPropagation(); startChange(file) }
  }
  const key = (event: KeyboardEvent) => {
    delete element.dataset.outputGatePointerFocus
    if (!stroke || ['Shift', 'Control', 'Meta', 'Alt'].includes(event.key)) return
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation() }
    finish()
  }
  const hidden = () => { if (document.hidden) finish() }
  const unsubscribe = useAppStore.subscribe(current => {
    // An unrelated edit, undo, document replacement or output rebuild ends the transaction.
    if (stroke && (current._past !== stroke.change.past || current._future !== stroke.change.future
      || selectOutputFiles(current) !== stroke.change.files)) finish()
  })
  element.addEventListener('pointerdown', down)
  element.addEventListener('pointermove', move)
  element.addEventListener('lostpointercapture', up)
  element.addEventListener('click', click)
  window.addEventListener('pointerdown', anotherPointer, true)
  window.addEventListener('pointerup', up, true)
  window.addEventListener('pointercancel', up, true)
  window.addEventListener('keydown', key, true)
  window.addEventListener('blur', finish)
  document.addEventListener('visibilitychange', hidden)
  return { dispose() {
    finish(); unsubscribe()
    delete element.dataset.outputGatePointerFocus
    element.removeEventListener('pointerdown', down)
    element.removeEventListener('pointermove', move)
    element.removeEventListener('lostpointercapture', up)
    element.removeEventListener('click', click)
    window.removeEventListener('pointerdown', anotherPointer, true)
    window.removeEventListener('pointerup', up, true)
    window.removeEventListener('pointercancel', up, true)
    window.removeEventListener('keydown', key, true)
    window.removeEventListener('blur', finish)
    document.removeEventListener('visibilitychange', hidden)
  } }
}
