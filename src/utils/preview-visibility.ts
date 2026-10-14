const callbacks = new Map<Element, (visible: boolean) => void>()
let observer: IntersectionObserver | undefined

/** One observer for the entire list, including its scroll-container clipping. */
export function observePreviewVisibility(element: Element, callback: (visible: boolean) => void) {
  if (typeof IntersectionObserver === 'undefined') { callback(true); return () => {} }
  observer ??= new IntersectionObserver(entries => {
    for (const entry of entries) callbacks.get(entry.target)?.(entry.isIntersecting)
  }, { rootMargin: '96px' })
  callbacks.set(element, callback)
  observer.observe(element)
  return () => {
    callbacks.delete(element)
    observer?.unobserve(element)
    if (!callbacks.size) { observer?.disconnect(); observer = undefined }
  }
}
