import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { zoomBoard, type BoardCamera, type BoardSize } from '../utils/preview-grid'

/** Image coordinates are original document pixels. CSS scaling never defines 100%. */
export function useZoomPan({ width, height }: BoardSize, document: unknown) {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [view, setView] = useState<BoardCamera>({ x: 0, y: 0, zoom: 1 })
  const [pixelRatio, setPixelRatio] = useState(window.devicePixelRatio || 1)
  const [dragging, setDragging] = useState(false)
  const camera = useRef(view), ratio = useRef(pixelRatio)
  const retained = useRef<{ document: unknown; width: number; height: number; viewport: BoardSize } | null>(null)
  const controls = useRef({ fit: () => {}, actualSize: () => {} })

  useLayoutEffect(() => {
    if (!element || !width || !height) return
    const size = () => ({ width: element.clientWidth, height: element.clientHeight })
    const fitCamera = (): BoardCamera => {
      const viewport = size(), zoom = Math.max(.00001, Math.min((viewport.width - 32) / width, (viewport.height - 32) / height))
      return { zoom, x: (viewport.width - width * zoom) / 2, y: (viewport.height - height * zoom) / 2 }
    }
    const update = (next: BoardCamera) => {
      const viewport = size(), w = width * next.zoom, h = height * next.zoom
      next.x = w <= viewport.width ? (viewport.width - w) / 2 : Math.min(viewport.width - 24, Math.max(24 - w, next.x))
      next.y = h <= viewport.height ? (viewport.height - h) / 2 : Math.min(viewport.height - 24, Math.max(24 - h, next.y))
      camera.current = next; setView(next)
    }
    const zoom = (x: number, y: number, factor: number) => update(zoomBoard(camera.current, x, y, factor,
      Math.min(fitCamera().zoom / 4, 1 / ratio.current), Math.max(8 / ratio.current, fitCamera().zoom)))
    controls.current = {
      fit: () => update(fitCamera()),
      actualSize: () => zoom(element.clientWidth / 2, element.clientHeight / 2, 1 / (ratio.current * camera.current.zoom)),
    }
    const resize = () => {
      const viewport = size()
      if (!viewport.width || !viewport.height) return
      const old = retained.current, nextRatio = window.devicePixelRatio || 1
      if (!old || old.document !== document || old.width !== width || old.height !== height) update(fitCamera())
      else {
        const next = { ...camera.current, x: camera.current.x + (viewport.width - old.viewport.width) / 2,
          y: camera.current.y + (viewport.height - old.viewport.height) / 2 }
        update(zoomBoard(next, viewport.width / 2, viewport.height / 2, ratio.current / nextRatio, .000001, Infinity))
      }
      ratio.current = nextRatio; setPixelRatio(nextRatio)
      retained.current = { document, width, height, viewport }
    }
    resize()
    const observer = new ResizeObserver(resize); observer.observe(element)
    window.addEventListener('resize', resize)
    const local = (event: { clientX: number; clientY: number }) => {
      const rect = element.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }
    const wheel = (event: WheelEvent) => {
      if (!event.deltaY) return
      event.preventDefault()
      const point = local(event), delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1)
      zoom(point.x, point.y, Math.exp(-Math.max(-160, Math.min(160, delta)) * .002))
    }
    const pointers = new Map<number, { x: number; y: number }>()
    let origin = { x: 0, y: 0 }, moved = false
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return
      event.preventDefault(); element.focus({ preventScroll: true }); element.setPointerCapture(event.pointerId)
      const point = local(event)
      if (!pointers.size) { origin = point; moved = false }
      pointers.set(event.pointerId, point)
    }
    const move = (event: PointerEvent) => {
      const prior = pointers.get(event.pointerId)
      if (!prior) return
      const point = local(event), before = [...pointers.values()]
      pointers.set(event.pointerId, point)
      moved ||= Math.hypot(point.x - origin.x, point.y - origin.y) > 4
      if (pointers.size === 2) {
        const after = [...pointers.values()], mid = (p: typeof before) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 })
        const a = mid(before), b = mid(after), distance = (p: typeof before) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)
        zoom(a.x, a.y, distance(after) / Math.max(1, distance(before)))
        update({ ...camera.current, x: camera.current.x + b.x - a.x, y: camera.current.y + b.y - a.y })
        moved = true
      } else if (moved) update({ ...camera.current, x: camera.current.x + point.x - prior.x, y: camera.current.y + point.y - prior.y })
      if (moved) setDragging(true)
    }
    const up = (event: PointerEvent) => { pointers.delete(event.pointerId); if (!pointers.size) setDragging(false) }
    const key = (event: KeyboardEvent) => {
      if (event.target !== element || event.isComposing) return
      if (event.key === '0' || event.key === '1') { event.preventDefault(); controls.current[event.key === '0' ? 'fit' : 'actualSize']() }
    }
    element.addEventListener('wheel', wheel, { passive: false })
    element.addEventListener('pointerdown', down); element.addEventListener('pointermove', move)
    element.addEventListener('pointerup', up); element.addEventListener('pointercancel', up); element.addEventListener('keydown', key)
    return () => {
      observer.disconnect(); window.removeEventListener('resize', resize)
      element.removeEventListener('wheel', wheel); element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', up); element.removeEventListener('keydown', key)
    }
  }, [element, width, height, document])

  const contentStyle: CSSProperties = { position: 'absolute', left: 0, top: 0, width, height, maxWidth: 'none', maxHeight: 'none',
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, transformOrigin: '0 0', willChange: 'transform',
    imageRendering: view.zoom * pixelRatio >= 2 ? 'pixelated' : 'auto' }
  const containerStyle: CSSProperties = { cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none' }
  return { containerRef: setElement, contentStyle, containerStyle, zoom: view.zoom * pixelRatio,
    fit: () => controls.current.fit(), actualSize: () => controls.current.actualSize() }
}
