import { useAppStore } from '../store'
import { selectDraftOutputs } from '../store/selectors'
import type { OutputFile } from './output-plan'
import { outputRenderQueue as queue, renderOutputFileAsync } from './output-render-queue'
import { boardHit, boardLayout, boardRect, boardRange, boardResolution, boardVisible, fitBoard, zoomBoard, type BoardCamera, type BoardLayout } from './preview-grid'
import { combineOutputSelection, type RangeSelectionMode } from '../store/output-selection'
import { OutputBoardRenderer, drawBoardSprite, type BoardSprite } from './output-board-renderer'
import { OutputDetail } from './output-detail'
import { sizePreviewSurface } from './preview-surface'
import { isTouchCompatibilityClick, switchOutputViewByTouch } from './output-view'
import { formatZoom } from './preview-zoom'

export interface BoardView { key: string; document: unknown; layout: BoardLayout; camera: BoardCamera }
type Request = { edge: number; release: () => void; unsubscribe: () => void }

/** Owns gestures and GPU resources outside React's render cycle. */
export function mountOutputBoard(element: HTMLDivElement, background: HTMLCanvasElement, canvas: HTMLCanvasElement,
  files: OutputFile[], view: { current: BoardView | null }, transparent: boolean,
  onMenu: (x: number, y: number) => void = () => {}) {
  const state = useAppStore.getState(), aspect = state.docWidth / Math.max(1, state.docHeight)
  const document = state.clipDocument ?? state.rawPsd ?? state.layerTree
  const draftIds = new Set(selectDraftOutputs(state).map(file => file.outputId))
  const key = JSON.stringify([state.clipFileName, aspect, files.map(file => file.outputId)])
  let width = element.clientWidth, height = element.clientHeight, frame = 0, idle: ReturnType<typeof setTimeout> | undefined
  let pixelRatio = window.devicePixelRatio || 1
  let disposed = false
  const retained = view.current?.key === key && view.current.document === document ? view.current : null
  let layout = retained ? retained.layout : boardLayout({ width, height }, files.length, aspect)
  let camera = retained ? { ...retained.camera } : fitBoard(layout, { width, height })
  const requests = new Map<string, Request>(), previous = new Map<string, Request>()
  const ctx = background.getContext('2d')!
  const patternCanvas = window.document.createElement('canvas'); patternCanvas.width = patternCanvas.height = 12
  const patternContext = patternCanvas.getContext('2d')!
  patternContext.fillStyle = '#fff'; patternContext.fillRect(0, 0, 12, 12)
  patternContext.fillStyle = '#ddd'; patternContext.fillRect(0, 0, 6, 6); patternContext.fillRect(6, 6, 6, 6)
  const pattern = ctx.createPattern(patternCanvas, 'repeat')!
  const css = getComputedStyle(element), textColor = css.getPropertyValue('--color-text-secondary').trim() || '#aaa'
  const accent = css.getPropertyValue('--color-accent').trim() || '#9a90ff'
  const orderedIds = files.map(file => file.outputId)
  const marqueeElement = element.querySelector<HTMLElement>('[data-board-marquee]')!
  const gateButton = element.querySelector<HTMLButtonElement>('[data-board-gate]')!
  let hover = -1, gateIndex = -1
  let marquee: { start: { x: number; y: number }; end: { x: number; y: number }; initial: ReadonlySet<string>; mode: RangeSelectionMode } | undefined
  const rangeSelection = () => marquee && combineOutputSelection(marquee.initial, boardRange(layout, camera, marquee.start, marquee.end).map(index => files[index].outputId), marquee.mode)
  function invalidate() { if (!frame && !disposed) frame = requestAnimationFrame(draw) }
  const renderer = new OutputBoardRenderer(canvas, invalidate)
  const detail = new OutputDetail(invalidate, state.projectSettings.processTable, state.outputConfig.revisionBorderEnabled, state.clipDiagnostics)
  function save() { view.current = { key, document, layout, camera: { ...camera } } }
  function draw() {
    frame = 0
    if (!width || !height || disposed) return
    const ratio = window.devicePixelRatio || 1, visible = boardVisible(layout, camera, { width, height })
    const edge = boardResolution(camera, visible.length, ratio)
    const current = useAppStore.getState()
    const selected = rangeSelection() ?? current.selectedOutputIds
    const sprites: BoardSprite[] = visible.map(index => {
      const rect = boardRect(layout, index), file = files[index]
      return { key: file.renderKey, image: queue.best(file, edge)?.canvas, x: camera.x + rect.x * camera.zoom, y: camera.y + rect.y * camera.zoom,
        width: rect.width * camera.zoom, height: rect.height * camera.zoom }
    })
    detail.begin()
    const tiles = sprites.flatMap((sprite, i) => detail.sprites(files[visible[i]], { left: sprite.x, top: sprite.y, width: sprite.width, height: sprite.height }, { width, height }, ratio, sprite.image))
    detail.end()
    const surface = sizePreviewSurface(background, width, height, ratio)
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, background.width, background.height)
    ctx.setTransform(ratio, 0, 0, ratio, -surface.x * ratio, -surface.y * ratio)
    ctx.font = '12px sans-serif'; ctx.textBaseline = 'top'
    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i], file = files[visible[i]], { x, y, width: w, height: h } = sprite
      ctx.fillStyle = transparent ? pattern : '#fff'; ctx.fillRect(x, y, w, h)
      const off = current.outputExclusions.has(file.gateId)
      if (off) { ctx.strokeStyle = textColor; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.strokeRect(x - 2, y - 2, w + 4, h + 4); ctx.setLineDash([]) }
      if (selected.has(file.outputId)) { ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2) }
      if (w >= 60 && camera.zoom * 28 >= 16) {
        ctx.save(); ctx.beginPath(); ctx.rect(x, y + h + 3, w - 24, 20); ctx.clip()
        ctx.fillStyle = textColor
        if (off) ctx.globalAlpha = .55
        const draft = draftIds.has(file.outputId)
        ctx.fillText((draft ? '未配置 · ' : '') + (current.outputConfig.structure === 'hierarchy' ? file.names.path || file.names.flatName : file.names.flatName), x, y + h + 4)
        ctx.restore()
        if (off) { ctx.fillStyle = textColor; ctx.fillText('×', x + w - 17, y + h + 4) }
      }
      if (queue.get(file, edge)?.error && w > 50) { ctx.fillStyle = '#b33'; ctx.fillText('⚠ 合成を再試行', x + 6, y + 6) }
    }
    const ready = renderer.draw(tiles, width, height, ratio)
    for (const sprite of renderer.available ? renderer.fallback : tiles) drawBoardSprite(ctx, sprite)
    if (detail.error) { ctx.fillStyle = '#b33'; ctx.fillText('⚠ 画像を選び直して原寸表示を再試行', 12, 12) }
    if (marqueeElement) {
      marqueeElement.hidden = !marquee || !moved
      if (marquee) Object.assign(marqueeElement.style, { left: `${Math.min(marquee.start.x, marquee.end.x)}px`, top: `${Math.min(marquee.start.y, marquee.end.y)}px`,
        width: `${Math.abs(marquee.end.x - marquee.start.x)}px`, height: `${Math.abs(marquee.end.y - marquee.start.y)}px` })
    }
    const active = files.findIndex(file => file.outputId === current.activeOutputId)
    gateIndex = hover >= 0 ? hover : element.contains(window.document.activeElement) ? active : -1
    if (gateButton) {
      const rect = gateIndex >= 0 ? boardRect(layout, gateIndex) : null
      const x = rect ? camera.x + (rect.x + rect.width) * camera.zoom - 22 : -1
      const y = rect ? camera.y + (rect.y + rect.height) * camera.zoom + 2 : -1
      gateButton.hidden = !rect || draftIds.has(files[gateIndex]?.outputId) || !!pointers.size || rect.width * camera.zoom < 60 || camera.zoom * 28 < 20 || x < 0 || x + 22 > width || y < 0 || y + 22 > height
      if (!gateButton.hidden) {
        gateButton.style.left = `${x}px`; gateButton.style.top = `${y}px`
        const off = current.outputExclusions.has(files[gateIndex].gateId)
        gateButton.setAttribute('aria-pressed', String(off))
        gateButton.setAttribute('aria-label', `${files[gateIndex].relativePath}を${off ? '出力に戻す' : '出力から外す'}`)
      }
    }
    element.dataset.selectedCount = String(selected.size)
    element.dataset.backend = renderer.available ? renderer.backend : 'canvas2d'
    element.dataset.columns = String(layout.columns); element.dataset.zoom = String(camera.zoom)
    element.dataset.camera = JSON.stringify(camera); element.dataset.layout = JSON.stringify(layout)
    element.dataset.textureBytes = String(renderer.textureBytes); element.dataset.resolution = String(edge)
    element.dataset.detailPending = String(detail.pending)
    element.dataset.cacheBytes = String(queue.getStats().bytes + detail.bytes)
    element.setAttribute('aria-busy', String(detail.pending || (renderer.available && !ready) || sprites.some((sprite, i) => !sprite.image && !queue.get(files[visible[i]], edge)?.error)))
    const badge = element.querySelector('[data-board-zoom]')
    if (badge) badge.textContent = formatZoom(camera.zoom / actualZoom())
    save()
  }
  function release(request: Request) { request.unsubscribe(); request.release() }
  function requestImages() {
    if (disposed || !width || !height) return
    const visible = boardVisible(layout, camera, { width, height }), edge = boardResolution(camera, visible.length, window.devicePixelRatio || 1)
    const keys = new Set(visible.map(index => files[index].renderKey))
    for (const map of [requests, previous]) for (const [key, request] of map) if (!keys.has(key)) { release(request); map.delete(key) }
    for (const index of visible) {
      const file = files[index], old = requests.get(file.renderKey)
      if (old?.edge === edge) continue
      if (old) {
        const prior = previous.get(file.renderKey); if (prior) release(prior)
        previous.set(file.renderKey, old)
      }
      const complete = () => {
        const prior = previous.get(file.renderKey)
        if (prior) { release(prior); previous.delete(file.renderKey) }
        invalidate()
      }
      const unsubscribe = queue.subscribe([file], edge, complete)
      const cancel = queue.request(file, edge, (cache, cancelled, requestedEdge) => renderOutputFileAsync(file, state.projectSettings.processTable,
        state.outputConfig.revisionBorderEnabled, cache, state.clipDiagnostics, cancelled, requestedEdge))
      requests.set(file.renderKey, { edge, unsubscribe, release: cancel })
      if (queue.get(file, edge)) complete()
    }
    invalidate()
  }
  function settle() {
    clearTimeout(idle)
    idle = setTimeout(requestImages, 140)
  }
  function interact() { clearTimeout(idle) }
  function move() {
    // Keep part of the board reachable, while allowing free panning around a sheet.
    camera.x = Math.min(width - 24, Math.max(24 - layout.width * camera.zoom, camera.x))
    camera.y = Math.min(height - 24, Math.max(24 - layout.height * camera.zoom, camera.y))
    invalidate()
  }
  function zoom(x: number, y: number, factor: number) {
    const fit = fitBoard(layout, { width, height }).zoom, actual = actualZoom()
    camera = zoomBoard(camera, x, y, factor, Math.min(fit / 4, actual / 4), Math.max(actual * 8, fit))
    move()
  }
  function actualZoom() { return state.docWidth / layout.tileWidth / (window.devicePixelRatio || 1) }
  function actualSize() {
    if (!files.length) return
    const current = files.findIndex(file => file.outputId === useAppStore.getState().activeOutputId)
    const rect = boardRect(layout, current >= 0 ? current : Math.max(0, boardHit(layout, camera, width / 2, height / 2)))
    const zoom = actualZoom()
    camera = { zoom, x: width / 2 - (rect.x + rect.width / 2) * zoom, y: height / 2 - (rect.y + rect.height / 2) * zoom }
    invalidate(); requestImages()
  }
  const local = (event: { clientX: number; clientY: number }) => { const rect = element.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top } }
  const wheel = (event: WheelEvent) => {
    if (!event.deltaY || (event.target as HTMLElement).closest('button')) return
    event.preventDefault(); interact()
    marquee = undefined
    const point = local(event), delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1)
    zoom(point.x, point.y, Math.exp(-Math.max(-160, Math.min(160, delta)) * .002))
    settle()
  }
  const pointers = new Map<number, { x: number; y: number }>()
  let moved = false, multi = false, origin = { x: 0, y: 0 }, lastTap = { time: 0, index: -1 }
  let clickSelection: ReadonlySet<string> = new Set(), clickTime = 0, clickIndex = -1
  function select(index: number, toggle = false, range = false) {
    if (index < 0 || index >= files.length) return
    useAppStore.getState().selectOutputFile(files[index].outputId, { toggle, range, orderedIds })
    const edge = requests.get(files[index].renderKey)?.edge
    if (edge && queue.get(files[index], edge)?.error) queue.retry(files[index])
    detail.retry(files[index])
  }
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
    if (event.pointerType === 'touch') event.preventDefault()
    element.focus({ preventScroll: true }); element.setPointerCapture(event.pointerId); interact()
    const point = local(event)
    if (!pointers.size) {
      origin = point; moved = false; multi = false
      const toggle = event.ctrlKey || event.metaKey
      if (toggle || event.shiftKey || element.dataset.selectionMode === 'true') marquee = {
        start: point, end: point, initial: useAppStore.getState().selectedOutputIds,
        mode: toggle ? event.shiftKey ? 'remove' : 'toggle' : 'add',
      }
    }
    pointers.set(event.pointerId, point)
    if (pointers.size > 1) { multi = true; moved = true; marquee = undefined }
  }
  const pointerMove = (event: PointerEvent) => {
    const prior = pointers.get(event.pointerId)
    if (!prior) {
      if (!(event.target as HTMLElement).closest('button')) {
        const point = local(event)
        let index = boardHit(layout, camera, point.x, point.y)
        if (index < 0 && hover >= 0) {
          const rect = boardRect(layout, hover), x = camera.x + rect.x * camera.zoom, y = camera.y + (rect.y + rect.height) * camera.zoom
          // Keep the action reachable across the small gap below its image.
          if (point.x >= x && point.x <= x + rect.width * camera.zoom && point.y >= y && point.y <= y + 26) index = hover
        }
        if (hover !== index) { hover = index; invalidate() }
      }
      return
    }
    const point = local(event), before = [...pointers.values()]
    pointers.set(event.pointerId, point)
    if (Math.hypot(point.x - origin.x, point.y - origin.y) > 4) moved = true
    if (marquee) { marquee.end = point; element.style.cursor = 'crosshair'; invalidate(); return }
    if (pointers.size === 2) {
      const after = [...pointers.values()], midpoint = (p: typeof before) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 })
      const a = midpoint(before), b = midpoint(after), distance = (p: typeof before) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)
      zoom(a.x, a.y, distance(after) / Math.max(1, distance(before)))
      camera.x += b.x - a.x; camera.y += b.y - a.y
    } else if (moved) { camera.x += point.x - prior.x; camera.y += point.y - prior.y }
    if (moved) element.style.cursor = 'grabbing'
    move()
  }
  const up = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return
    const point = local(event), index = boardHit(layout, camera, point.x, point.y)
    pointers.delete(event.pointerId)
    if (marquee && moved && event.type === 'pointerup') {
      marquee.end = point
      const ids = rangeSelection()!
      useAppStore.getState().setOutputSelection(ids)
    } else if (!moved && !multi && event.type === 'pointerup') {
      const now = performance.now()
      if (index !== clickIndex || now - clickTime > 400) clickSelection = useAppStore.getState().selectedOutputIds
      clickIndex = index; clickTime = now
      if (index < 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey) useAppStore.getState().setOutputSelection(new Set())
      select(index, event.ctrlKey || event.metaKey || element.dataset.selectionMode === 'true', event.shiftKey)
      if (event.pointerType === 'touch' && element.dataset.selectionMode !== 'true') {
        if (index >= 0 && index === lastTap.index && now - lastTap.time < 350) {
          if (clickSelection.has(files[index].outputId)) useAppStore.getState().setOutputSelection(clickSelection)
          switchOutputViewByTouch('single')
        }
        lastTap = { time: now, index }
      }
    }
    marquee = undefined
    if (!pointers.size) { element.style.cursor = ''; settle(); invalidate() }
  }
  const doubleClick = (event: MouseEvent) => {
    if (isTouchCompatibilityClick() || element.dataset.selectionMode === 'true') return
    if (event.ctrlKey || event.metaKey || event.shiftKey) return
    if ((event.target as HTMLElement).closest('button')) return
    const point = local(event), index = boardHit(layout, camera, point.x, point.y)
    if (index >= 0) {
      select(index)
      if (clickSelection.has(files[index].outputId)) useAppStore.getState().setOutputSelection(clickSelection)
      useAppStore.getState().setOutputViewMode('single')
    }
  }
  const cancel = () => {
    marquee = undefined; moved = true
    const captured = [...pointers.keys()]; pointers.clear()
    for (const id of captured) if (element.hasPointerCapture(id)) element.releasePointerCapture(id)
    element.style.cursor = ''; settle(); invalidate()
  }
  const lostCapture = (event: PointerEvent) => { if (pointers.has(event.pointerId)) cancel() }
  const leave = () => { if (!pointers.size) { hover = -1; invalidate() } }
  const contextMenu = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault(); cancel()
    const point = local(event), index = boardHit(layout, camera, point.x, point.y)
    if (index >= 0 && !useAppStore.getState().selectedOutputIds.has(files[index].outputId)) select(index)
    onMenu(event.clientX, event.clientY)
  }
  const toggleGate = () => {
    const file = files[gateIndex]
    if (file && !draftIds.has(file.outputId)) useAppStore.getState().setOutputsEnabled(new Set([file.outputId]), useAppStore.getState().outputExclusions.has(file.gateId))
  }
  const keyboard = (event: KeyboardEvent) => {
    if (event.target !== element || event.isComposing) return
    const current = files.findIndex(file => file.outputId === useAppStore.getState().activeOutputId)
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: layout.columns, ArrowUp: -layout.columns }[event.key]
    if (delta !== undefined) { event.preventDefault(); select(Math.max(0, Math.min(files.length - 1, current + delta)), event.ctrlKey || event.metaKey, event.shiftKey) }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') { event.preventDefault(); useAppStore.getState().setOutputSelection(new Set(orderedIds)) }
    if (event.key === 'Escape') { event.preventDefault(); if (marquee) cancel(); else useAppStore.getState().setOutputSelection(new Set()) }
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) { event.preventDefault(); const rect = element.getBoundingClientRect(); onMenu(rect.left + 12, rect.top + 12) }
    if (event.key === 'Enter' && current >= 0) { event.preventDefault(); useAppStore.getState().setOutputViewMode('single') }
    if (event.key === '+' || event.key === '=' || event.key === '-') { event.preventDefault(); interact(); zoom(width / 2, height / 2, event.key === '-' ? 1 / 1.2 : 1.2); settle() }
    if (event.key === '0') fit()
    if (event.key === '1') actualSize()
  }
  const unsubscribe = useAppStore.subscribe((current, old) => {
    if (current.activeOutputId !== old.activeOutputId) {
      const index = files.findIndex(file => file.outputId === current.activeOutputId)
      if (index >= 0 && !boardVisible(layout, camera, { width, height }).includes(index)) {
        const rect = boardRect(layout, index)
        camera.x = width / 2 - (rect.x + rect.width / 2) * camera.zoom
        camera.y = height / 2 - (rect.y + rect.height / 2) * camera.zoom
        settle()
      }
    }
    if (current.selectedOutputIds !== old.selectedOutputIds || current.outputExclusions !== old.outputExclusions) invalidate()
  })
  function fit(rearrange = false) {
    if (rearrange) layout = boardLayout({ width, height }, files.length, aspect)
    camera = fitBoard(layout, { width, height }); invalidate(); requestImages()
  }
  const resizeViewport = () => {
    const nextWidth = element.clientWidth, nextHeight = element.clientHeight
    if (!nextWidth || !nextHeight) return
    camera.x += (nextWidth - width) / 2; camera.y += (nextHeight - height) / 2
    const nextRatio = window.devicePixelRatio || 1
    camera = zoomBoard(camera, nextWidth / 2, nextHeight / 2, pixelRatio / nextRatio, .000001, Infinity)
    pixelRatio = nextRatio
    width = nextWidth; height = nextHeight; invalidate(); requestImages()
  }
  const resize = new ResizeObserver(resizeViewport)
  resize.observe(element)
  window.addEventListener('resize', resizeViewport)
  window.addEventListener('blur', cancel)
  element.addEventListener('contextmenu', contextMenu); element.addEventListener('pointerleave', leave)
  gateButton?.addEventListener('click', toggleGate)
  element.addEventListener('wheel', wheel, { passive: false })
  element.addEventListener('pointerdown', down); element.addEventListener('pointermove', pointerMove)
  element.addEventListener('pointerup', up); element.addEventListener('pointercancel', up)
  element.addEventListener('lostpointercapture', lostCapture)
  element.addEventListener('dblclick', doubleClick); element.addEventListener('keydown', keyboard)
  requestImages()
  return { fit, actualSize, dispose() {
    disposed = true; save(); cancelAnimationFrame(frame); clearTimeout(idle); resize.disconnect(); unsubscribe()
    detail.dispose(); for (const map of [requests, previous]) for (const request of map.values()) release(request)
    renderer.dispose(); background.width = background.height = 1; patternCanvas.width = patternCanvas.height = 1
    element.removeEventListener('wheel', wheel); element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', pointerMove)
    element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', up)
    element.removeEventListener('lostpointercapture', lostCapture)
    element.removeEventListener('dblclick', doubleClick); element.removeEventListener('keydown', keyboard)
    window.removeEventListener('resize', resizeViewport)
    window.removeEventListener('blur', cancel)
    element.removeEventListener('contextmenu', contextMenu); element.removeEventListener('pointerleave', leave)
    gateButton?.removeEventListener('click', toggleGate)
  } }
}
