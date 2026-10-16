import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { rowAtOffset, rowOffsets, visibleRowIndices } from '../utils/virtual-rows'

const emptySizes: ReadonlyMap<number, number> = new Map()
interface Measurements { items: readonly unknown[]; signature: string; sizes: ReadonlyMap<number, number> }

function readViewport(element: HTMLElement) {
  const style = getComputedStyle(element)
  const row = element.querySelector<HTMLElement>('[role="option"]')
  const rowStyle = row ? getComputedStyle(row) : style
  const estimate = parseFloat(style.getPropertyValue('--output-row-height')) || 57
  return {
    top: Math.max(0, element.scrollTop - (parseFloat(style.paddingTop) || 0)),
    height: element.clientHeight,
    signature: `${element.clientWidth}/${rowStyle.font}/${rowStyle.lineHeight}/${estimate}`,
    estimate,
  }
}

/** Variable-height rows: full filenames and draft headings keep their natural size. */
export function useVirtualOutputRows(list: RefObject<HTMLDivElement | null>, items: readonly unknown[], activeIndex: number, active: boolean) {
  const [viewport, setViewport] = useState({ top: 0, height: 0, signature: '', estimate: 57 })
  const [measurements, setMeasurements] = useState<Measurements>({ items: [], signature: '', sizes: emptySizes })
  const pendingAnchor = useRef<{ top: number; delta: number; items: readonly unknown[]; signature: string } | null>(null)
  const pendingScroll = useRef<ScrollLogicalPosition | null>(null)
  const measured = measurements.items === items && measurements.signature === viewport.signature
  const sizes = measured ? measurements.sizes : emptySizes
  const offsets = useMemo(() => rowOffsets(items.length, sizes, viewport.estimate), [items.length, sizes, viewport.estimate])
  const indices = useMemo(() => visibleRowIndices(offsets, viewport.top, viewport.height, activeIndex), [offsets, viewport.top, viewport.height, activeIndex])
  const empty = items.length === 0

  useLayoutEffect(() => {
    const element = list.current
    if (!element) return
    const updateViewport = () => {
      const next = readViewport(element)
      setViewport(previous => previous.top === next.top && previous.height === next.height && previous.signature === next.signature ? previous : next)
    }
    let frame = 0
    const scroll = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; updateViewport() }) }
    const resize = new ResizeObserver(updateViewport)
    resize.observe(element)
    element.addEventListener('scroll', scroll, { passive: true })
    document.fonts?.addEventListener('loadingdone', updateViewport)
    updateViewport()
    return () => {
      resize.disconnect(); cancelAnimationFrame(frame)
      element.removeEventListener('scroll', scroll)
      document.fonts?.removeEventListener('loadingdone', updateViewport)
    }
  }, [list, empty])

  useLayoutEffect(() => {
    if (active && activeIndex >= 0) {
      pendingScroll.current = 'nearest'
      list.current?.querySelector('[data-active-output="true"]')?.scrollIntoView?.({ block: 'nearest' })
    } else pendingScroll.current = null
  }, [list, active, activeIndex])

  useLayoutEffect(() => {
    const element = list.current
    if (!element) return
    const pending = pendingAnchor.current
    pendingAnchor.current = null
    if (pending && pending.items === items && pending.signature === viewport.signature && Math.abs(element.scrollTop - pending.top) < 1) element.scrollBy({ top: pending.delta })
    const rows = [...element.querySelectorAll<HTMLElement>('[data-virtual-row]')]
    const measure = () => {
      const current = readViewport(element)
      if (current.signature !== viewport.signature) { setViewport(current); return }
      const next = new Map(sizes)
      const padding = parseFloat(getComputedStyle(element).paddingTop) || 0
      const anchor = rowAtOffset(offsets, Math.max(0, element.scrollTop - padding))
      let changed = false, delta = 0
      for (const row of rows) {
        const index = Number(row.dataset.virtualRow), height = row.getBoundingClientRect().height
        if (!height || Math.abs((sizes.get(index) ?? viewport.estimate) - height) < 0.1) continue
        if (index < anchor) delta += height - (sizes.get(index) ?? viewport.estimate)
        next.set(index, height); changed = true
      }
      if (pendingScroll.current) {
        element.querySelector('[data-active-output="true"]')?.scrollIntoView?.({ block: pendingScroll.current })
        // A jump first mounts estimated rows at its destination. Keep the
        // selected row in view until those rows have their measured heights.
        if (!changed && Math.abs(Math.max(0, element.scrollTop - padding) - viewport.top) < 1) pendingScroll.current = null
      } else if (delta) pendingAnchor.current = { top: element.scrollTop, delta, items, signature: viewport.signature }
      // Also replace an all-estimated layout: otherwise the state could retain
      // the previous document's OutputFile objects and their source canvases.
      if (changed || !measured) setMeasurements({ items, signature: viewport.signature, sizes: next })
    }
    measure()
    const observer = new ResizeObserver(measure)
    rows.forEach(row => observer.observe(row))
    // Connections also need to move when measured heights change without a
    // scroll, selection or DOM child change.
    element.dispatchEvent(new Event('output-layout', { bubbles: true }))
    return () => observer.disconnect()
  }, [list, items, indices, offsets, sizes, measured, viewport.signature, viewport.estimate, viewport.top])

  useEffect(() => {
    const element = list.current
    if (!element) return
    const reveal = (block: ScrollLogicalPosition) => {
      pendingScroll.current = block
      element.querySelector('[data-active-output="true"]')?.scrollIntoView?.({ block })
    }
    const returnToActive = () => reveal('center')
    const cancel = () => { pendingScroll.current = null }
    const observer = new ResizeObserver(() => reveal('nearest'))
    observer.observe(element)
    element.addEventListener('output-scroll-active', returnToActive)
    element.addEventListener('wheel', cancel, { passive: true })
    element.addEventListener('pointerdown', cancel)
    return () => {
      observer.disconnect()
      element.removeEventListener('output-scroll-active', returnToActive)
      element.removeEventListener('wheel', cancel)
      element.removeEventListener('pointerdown', cancel)
    }
  }, [list])

  return { indices, offsets, height: offsets.at(-1) ?? 0 }
}
