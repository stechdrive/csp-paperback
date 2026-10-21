import { memo, useEffect, useRef, useState } from 'react'
import type { OutputPreviewEntry } from '../hooks/useOutputPreview'
import type { OutputFile } from '../utils/output-plan'
import type { BoardCamera } from '../utils/preview-grid'
import { OutputBoardRenderer, drawBoardSprite } from '../utils/output-board-renderer'
import { OutputDetail } from '../utils/output-detail'
import { useAppStore } from '../store'
import { outputRenderQueue } from '../utils/output-render-queue'
import { sizePreviewSurface } from '../utils/preview-surface'
import styles from './OutputPreview.module.css'

/** Only viewport-sized canvases reach the browser compositor, even at 800% on a large CLIP. */
export const OutputPreviewImage = memo(function OutputPreviewImage({ entry, file, transparent, camera, pixelRatio }: {
  entry: OutputPreviewEntry; file: OutputFile; transparent: boolean; camera: BoardCamera; pixelRatio: number
}) {
  const viewport = useRef<HTMLDivElement>(null), background = useRef<HTMLCanvasElement>(null), canvas = useRef<HTMLCanvasElement>(null)
  const controller = useRef<{ update: (camera: BoardCamera, ratio: number) => void; retry: () => void } | null>(null)
  const [error, setError] = useState<string>()
  useEffect(() => {
    const element = viewport.current!, bg = background.current!, surface = canvas.current!, ctx = bg.getContext('2d')!
    const state = useAppStore.getState()
    let view: BoardCamera = { x: 0, y: 0, zoom: 1 }, ratio = 1, frame = 0, disposed = false
    const invalidate = () => { if (!frame && !disposed) frame = requestAnimationFrame(draw) }
    const renderer = new OutputBoardRenderer(surface, invalidate)
    const detail = new OutputDetail(invalidate, state.projectSettings.processTable, state.outputConfig.revisionBorderEnabled, state.clipDiagnostics)
    const checker = document.createElement('canvas'); checker.width = checker.height = 12
    const checkerContext = checker.getContext('2d')!
    checkerContext.fillStyle = '#fff'; checkerContext.fillRect(0, 0, 12, 12)
    checkerContext.fillStyle = '#ddd'; checkerContext.fillRect(0, 0, 6, 6); checkerContext.fillRect(6, 6, 6, 6)
    const pattern = ctx.createPattern(checker, 'repeat')!
    function draw() {
      frame = 0
      const width = element.clientWidth, height = element.clientHeight
      if (!width || !height || disposed) return
      const bounds = sizePreviewSurface(bg, width, height, ratio)
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, bg.width, bg.height)
      ctx.setTransform(ratio, 0, 0, ratio, -bounds.x * ratio, -bounds.y * ratio)
      const rect = { left: view.x, top: view.y, width: state.docWidth * view.zoom, height: state.docHeight * view.zoom }
      ctx.fillStyle = transparent ? pattern : '#fff'; ctx.fillRect(rect.left, rect.top, rect.width, rect.height)
      detail.begin()
      const sprites = detail.sprites(file, rect, { width, height }, ratio, entry.canvas)
      detail.end()
      const ready = renderer.draw(sprites, width, height, ratio)
      for (const sprite of renderer.available ? renderer.fallback : sprites) drawBoardSprite(ctx, sprite)
      element.dataset.camera = JSON.stringify(view)
      element.dataset.imageWidth = String(rect.width * ratio)
      element.dataset.textureBytes = String(renderer.textureBytes)
      element.dataset.cacheBytes = String(outputRenderQueue.getStats().bytes + detail.bytes)
      element.dataset.backend = renderer.available ? renderer.backend : 'canvas2d'
      element.setAttribute('aria-busy', String(detail.pending || (renderer.available && !ready)))
      setError(detail.error)
    }
    controller.current = { update(next, nextRatio) { view = next; ratio = nextRatio; invalidate() }, retry: () => detail.retry() }
    const observer = new ResizeObserver(invalidate); observer.observe(element)
    return () => {
      disposed = true; observer.disconnect(); cancelAnimationFrame(frame); detail.dispose(); renderer.dispose()
      bg.width = bg.height = checker.width = checker.height = 1; controller.current = null
    }
  }, [entry.canvas, file, transparent])
  useEffect(() => { controller.current?.update(camera, pixelRatio) }, [camera, pixelRatio, entry.canvas, file, transparent])
  return <div ref={viewport} className={styles.singleSurface} data-testid="single-preview-surface">
    <canvas ref={background} className={styles.boardCanvas} aria-hidden="true" />
    <canvas ref={canvas} className={styles.boardCanvas} aria-label={entry.flatName} />
    {error && <button className={styles.detailError} title={error} onClick={() => controller.current?.retry()}>⚠ 原寸表示を再試行</button>}
  </div>
})
