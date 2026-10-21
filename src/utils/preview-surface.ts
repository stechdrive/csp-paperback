/** Give the browser a one-to-one device-pixel surface, including fractional OS scaling. */
export function sizePreviewSurface(canvas: HTMLCanvasElement, width: number, height: number, ratio: number) {
  const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio))
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
  const origin = canvas.parentElement?.getBoundingClientRect()
  const x = origin ? Math.round(origin.left * ratio) / ratio - origin.left : 0
  const y = origin ? Math.round(origin.top * ratio) / ratio - origin.top : 0
  canvas.style.width = `${w / ratio}px`; canvas.style.height = `${h / ratio}px`
  canvas.style.left = `${x}px`; canvas.style.top = `${y}px`
  // Filtering has already happened inside the surface. Never filter the framebuffer again.
  canvas.style.imageRendering = 'pixelated'
  return { width: w / ratio, height: h / ratio, x, y }
}
