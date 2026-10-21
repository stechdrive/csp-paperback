import { useAppStore } from '../store'
import { selectDraftOutputs } from '../store/selectors'
import type { OutputFile } from './output-plan'
import { outputRenderQueue as queue, renderOutputFileAsync } from './output-render-queue'
import { boardHit, boardLayout, boardRect, boardResolution, boardVisible, fitBoard, zoomBoard, type BoardCamera, type BoardLayout } from './preview-grid'
import { OutputBoardRenderer, type BoardSprite } from './output-board-renderer'
import { isTouchCompatibilityClick, switchOutputViewByTouch } from './output-view'

export interface BoardView { key: string; document: unknown; layout: BoardLayout; camera: BoardCamera }
type Request = { edge: number; release: () => void; unsubscribe: () => void }

/** Owns gestures and GPU resources outside React's render cycle. */
export function mountOutputBoard(element: HTMLDivElement, background: HTMLCanvasElement, canvas: HTMLCanvasElement,
  files: OutputFile[], view: { current: BoardView | null }, transparent: boolean) {
  const state = useAppStore.getState(), aspect = state.docWidth / Math.max(1, state.docHeight)
  const document = state.clipDocument ?? state.rawPsd ?? state.layerTree
  const draftIds = new Set(selectDraftOutputs(state).map(file => file.outputId))
  const key = JSON.stringify([state.clipFileName, aspect, files.map(file => file.outputId)])
  let width = element.clientWidth, height = element.clientHeight, frame = 0, idle: ReturnType<typeof setTimeout> | undefined
  let resume: (() => void) | undefined, disposed = false
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
  function invalidate() { if (!frame && !disposed) frame = requestAnimationFrame(draw) }
  const renderer = new OutputBoardRenderer(canvas, invalidate)
  function save() { view.current = { key, document, layout, camera: { ...camera } } }
  function draw() {
    frame = 0
    if (!width || !height || disposed) return
    const ratio = Math.min(2, window.devicePixelRatio || 1), visible = boardVisible(layout, camera, { width, height })
    const edge = boardResolution(camera, visible.length, ratio)
    const current = useAppStore.getState()
    const sprites: BoardSprite[] = visible.map(index => {
      const rect = boardRect(layout, index), file = files[index]
      return { key: file.renderKey, image: queue.best(file, edge)?.canvas, x: camera.x + rect.x * camera.zoom, y: camera.y + rect.y * camera.zoom,
        width: rect.width * camera.zoom, height: rect.height * camera.zoom }
    })
    const w = Math.round(width * ratio), h = Math.round(height * ratio)
    if (background.width !== w || background.height !== h) { background.width = w; background.height = h }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height)
    ctx.font = '12px sans-serif'; ctx.textBaseline = 'top'
    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i], file = files[visible[i]], { x, y, width: w, height: h } = sprite
      ctx.fillStyle = transparent ? pattern : '#fff'; ctx.fillRect(x, y, w, h)
      if (current.selectedOutputIds.has(file.outputId)) { ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2) }
      if (!renderer.available && sprite.image) ctx.drawImage(sprite.image, x, y, w, h)
      if (w >= 60 && camera.zoom * 28 >= 16) {
        ctx.save(); ctx.beginPath(); ctx.rect(x, y + h + 3, w, 20); ctx.clip()
        ctx.fillStyle = textColor
        const draft = draftIds.has(file.outputId)
        ctx.fillText((draft ? '未配置 · ' : '') + (current.outputConfig.structure === 'hierarchy' ? file.names.path || file.names.flatName : file.names.flatName), x, y + h + 4)
        ctx.restore()
      }
      if (queue.get(file, edge)?.error && w > 50) { ctx.fillStyle = '#b33'; ctx.fillText('⚠ 合成を再試行', x + 6, y + 6) }
    }
    const ready = renderer.draw(sprites, width, height, ratio)
    for (const sprite of renderer.fallback) if (sprite.image) ctx.drawImage(sprite.image, sprite.x, sprite.y, sprite.width, sprite.height)
    element.dataset.backend = renderer.available ? renderer.backend : 'canvas2d'
    element.dataset.columns = String(layout.columns); element.dataset.zoom = String(camera.zoom)
    element.dataset.camera = JSON.stringify(camera); element.dataset.layout = JSON.stringify(layout)
    element.dataset.textureBytes = String(renderer.textureBytes); element.dataset.resolution = String(edge)
    element.setAttribute('aria-busy', String((renderer.available && !ready) || sprites.some((sprite, i) => !sprite.image && !queue.get(files[visible[i]], edge)?.error)))
    const badge = element.querySelector('[data-board-zoom]')
    if (badge) badge.textContent = Math.round(camera.zoom / fitBoard(layout, { width, height }).zoom * 100) + '%'
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
      const cancel = queue.request(file, edge, (cache, cancelled) => renderOutputFileAsync(file, state.projectSettings.processTable,
        state.outputConfig.revisionBorderEnabled, cache, state.clipDiagnostics, cancelled))
      requests.set(file.renderKey, { edge, unsubscribe, release: cancel })
      if (queue.get(file, edge)) complete()
    }
    invalidate()
  }
  function settle() {
    clearTimeout(idle)
    idle = setTimeout(() => { resume?.(); resume = undefined; requestImages() }, 140)
  }
  function interact() { resume ??= queue.pause(); clearTimeout(idle) }
  function move() {
    // Keep part of the board reachable, while allowing free panning around a sheet.
    camera.x = Math.min(width - 24, Math.max(24 - layout.width * camera.zoom, camera.x))
    camera.y = Math.min(height - 24, Math.max(24 - layout.height * camera.zoom, camera.y))
    invalidate()
  }
  function zoom(x: number, y: number, factor: number) {
    camera = zoomBoard(camera, x, y, factor, fitBoard(layout, { width, height }).zoom / 4)
    move()
  }
  const local = (event: { clientX: number; clientY: number }) => { const rect = element.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top } }
  const wheel = (event: WheelEvent) => {
    if (!event.deltaY || (event.target as HTMLElement).closest('button')) return
    event.preventDefault(); interact()
    const point = local(event), delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1)
    zoom(point.x, point.y, Math.exp(-Math.max(-160, Math.min(160, delta)) * .002))
    settle()
  }
  const pointers = new Map<number, { x: number; y: number }>()
  let moved = false, multi = false, origin = { x: 0, y: 0 }, lastTap = { time: 0, index: -1 }
  function select(index: number, toggle = false, range = false) {
    if (index < 0 || index >= files.length) return
    useAppStore.getState().selectOutputFile(files[index].outputId, { toggle, range, orderedIds: files.map(file => file.outputId) })
    const edge = requests.get(files[index].renderKey)?.edge
    if (edge && queue.get(files[index], edge)?.error) queue.retry(files[index])
  }
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
    if (event.pointerType === 'touch') event.preventDefault()
    element.focus({ preventScroll: true }); element.setPointerCapture(event.pointerId); interact()
    const point = local(event)
    if (!pointers.size) { origin = point; moved = false; multi = false }
    pointers.set(event.pointerId, point)
    if (pointers.size > 1) { multi = true; moved = true }
  }
  const pointerMove = (event: PointerEvent) => {
    const prior = pointers.get(event.pointerId)
    if (!prior) return
    const point = local(event), before = [...pointers.values()]
    pointers.set(event.pointerId, point)
    if (Math.hypot(point.x - origin.x, point.y - origin.y) > 4) moved = true
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
    if (!moved && !multi && event.type === 'pointerup') {
      select(index, event.ctrlKey || event.metaKey, event.shiftKey)
      if (event.pointerType === 'touch') {
        const now = performance.now()
        if (index >= 0 && index === lastTap.index && now - lastTap.time < 350) switchOutputViewByTouch('single')
        lastTap = { time: now, index }
      }
    }
    if (!pointers.size) { element.style.cursor = ''; settle() }
  }
  const doubleClick = (event: MouseEvent) => {
    if (isTouchCompatibilityClick()) return
    if ((event.target as HTMLElement).closest('button')) return
    const point = local(event), index = boardHit(layout, camera, point.x, point.y)
    if (index >= 0) { select(index); useAppStore.getState().setOutputViewMode('single') }
  }
  const keyboard = (event: KeyboardEvent) => {
    if (event.target !== element || event.isComposing) return
    const current = files.findIndex(file => file.outputId === useAppStore.getState().activeOutputId)
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: layout.columns, ArrowUp: -layout.columns }[event.key]
    if (delta !== undefined) { event.preventDefault(); select(Math.max(0, Math.min(files.length - 1, current + delta)), false, event.shiftKey) }
    if (event.key === 'Enter' && current >= 0) { event.preventDefault(); useAppStore.getState().setOutputViewMode('single') }
    if (event.key === '+' || event.key === '=' || event.key === '-') { event.preventDefault(); interact(); zoom(width / 2, height / 2, event.key === '-' ? 1 / 1.2 : 1.2); settle() }
    if (event.key === '0') fit()
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
    if (current.selectedOutputIds !== old.selectedOutputIds) invalidate()
  })
  function fit(rearrange = false) {
    if (rearrange) layout = boardLayout({ width, height }, files.length, aspect)
    camera = fitBoard(layout, { width, height }); invalidate(); requestImages()
  }
  const resize = new ResizeObserver(() => {
    const nextWidth = element.clientWidth, nextHeight = element.clientHeight
    if (!nextWidth || !nextHeight) return
    camera.x += (nextWidth - width) / 2; camera.y += (nextHeight - height) / 2
    width = nextWidth; height = nextHeight; invalidate(); requestImages()
  })
  resize.observe(element)
  element.addEventListener('wheel', wheel, { passive: false })
  element.addEventListener('pointerdown', down); element.addEventListener('pointermove', pointerMove)
  element.addEventListener('pointerup', up); element.addEventListener('pointercancel', up)
  element.addEventListener('dblclick', doubleClick); element.addEventListener('keydown', keyboard)
  requestImages()
  return { fit, dispose() {
    disposed = true; save(); cancelAnimationFrame(frame); clearTimeout(idle); resize.disconnect(); unsubscribe()
    resume?.(); for (const map of [requests, previous]) for (const request of map.values()) release(request)
    renderer.dispose(); background.width = background.height = 1; patternCanvas.width = patternCanvas.height = 1
    element.removeEventListener('wheel', wheel); element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', pointerMove)
    element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', up)
    element.removeEventListener('dblclick', doubleClick); element.removeEventListener('keydown', keyboard)
  } }
}
