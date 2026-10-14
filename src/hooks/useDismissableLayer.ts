import { useLayoutEffect, useRef, type RefObject } from 'react'

type Reason = 'pointer' | 'focus' | 'escape' | 'tab' | 'scroll' | 'resize' | 'blur' | 'superseded'
interface Options {
  open: boolean
  content: RefObject<HTMLElement | null>
  trigger?: RefObject<HTMLElement | null>
  onDismiss: (reason: Reason) => void
  initialFocus?: () => HTMLElement | null | undefined
  closeOnTab?: boolean
  closeOnScroll?: boolean
  closeOnResize?: boolean
  closeOnBlur?: boolean
  tooltip?: boolean
}
interface Layer { options: () => Options }
const layers: Layer[] = []

// A portal belongs to the layer containing its trigger, even though its DOM
// lives elsewhere. This also covers a tooltip inside a portalled submenu.
function contains(layer: Layer, target: Node, visited = new Set<Layer>()): boolean {
  if (visited.has(layer)) return false
  visited.add(layer)
  const { content, trigger } = layer.options()
  if (content.current?.contains(target) || trigger?.current?.contains(target)) return true
  return layers.some(child => child !== layer && child.options().trigger?.current
    && content.current?.contains(child.options().trigger!.current)
    && contains(child, target, visited))
}

function outside(event: Event) {
  if (!(event.target instanceof Node)) return
  // Decide before dismissing anything: removing a child must not change its
  // parent's containment decision for this same event. Never swallow the click.
  const outsideLayers = layers.filter(layer => !contains(layer, event.target as Node))
  for (const layer of outsideLayers.reverse()) layer.options().onDismiss(event.type === 'focusin' ? 'focus' : 'pointer')
}

function key(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing) return
  const top = layers.at(-1)?.options()
  if (!top) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopImmediatePropagation()
    top.onDismiss('escape')
  } else if (event.key === 'Tab' && top.closeOnTab) top.onDismiss('tab')
}

function scroll(event: Event) {
  for (const layer of [...layers].reverse()) {
    if (layer.options().closeOnScroll && event.target instanceof Node && !contains(layer, event.target)) layer.options().onDismiss('scroll')
  }
}
function resize() { for (const layer of [...layers].reverse()) if (layer.options().closeOnResize) layer.options().onDismiss('resize') }
function blur() { for (const layer of [...layers].reverse()) if (layer.options().closeOnBlur !== false) layer.options().onDismiss('blur') }

function listen(add: boolean) {
  const method = add ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', outside, true)
  document[method]('focusin', outside, true)
  document[method]('keydown', key as EventListener, true)
  window[method]('scroll', scroll, true)
  window[method]('resize', resize)
  window[method]('blur', blur)
}

/** Shared dismissal without cancelling selection, visibility gestures or drag. */
export function useDismissableLayer(options: Options) {
  const latest = useRef(options)
  useLayoutEffect(() => { latest.current = options })
  useLayoutEffect(() => {
    if (!options.open) return
    if (latest.current.tooltip) for (const layer of [...layers]) if (layer.options().tooltip) layer.options().onDismiss('superseded')
    if (!layers.length) listen(true)
    const layer = { options: () => latest.current }
    layers.push(layer)
    latest.current.initialFocus?.()?.focus({ preventScroll: true })
    return () => {
      layers.splice(layers.indexOf(layer), 1)
      if (!layers.length) listen(false)
    }
  }, [options.open])
}
