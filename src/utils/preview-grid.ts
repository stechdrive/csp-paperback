export interface BoardLayout { columns: number; count: number; tileWidth: number; tileHeight: number; stepX: number; stepY: number; width: number; height: number }
export interface BoardCamera { x: number; y: number; zoom: number }
export interface BoardSize { width: number; height: number }

/** Choose the arrangement once. Camera zoom and viewport resize never reflow it. */
export function boardLayout(size: BoardSize, count: number, aspect: number): BoardLayout {
  const ratio = Math.max(.01, aspect), tileWidth = 256 * Math.min(1, ratio), tileHeight = 256 / Math.max(1, ratio)
  const stepX = tileWidth + 20, stepY = tileHeight + 28
  const columns = Math.max(1, Math.min(count, Math.round(Math.sqrt(Math.max(1, count) * size.width * stepY / Math.max(1, size.height * stepX)))))
  return { columns, count, tileWidth, tileHeight, stepX, stepY,
    width: columns * stepX - 20, height: Math.max(1, Math.ceil(count / columns)) * stepY - 8 }
}
export function fitBoard(layout: BoardLayout, size: BoardSize): BoardCamera {
  const zoom = Math.max(.00001, Math.min((size.width - 32) / layout.width, (size.height - 32) / layout.height))
  return { zoom, x: (size.width - layout.width * zoom) / 2, y: (size.height - layout.height * zoom) / 2 }
}
export function zoomBoard(camera: BoardCamera, x: number, y: number, factor: number, minimum: number, maximum = 16): BoardCamera {
  const zoom = Math.max(minimum, Math.min(maximum, camera.zoom * factor)), scale = zoom / camera.zoom
  return { zoom, x: x - (x - camera.x) * scale, y: y - (y - camera.y) * scale }
}
export function boardRect(layout: BoardLayout, index: number) {
  return { x: index % layout.columns * layout.stepX, y: Math.floor(index / layout.columns) * layout.stepY, width: layout.tileWidth, height: layout.tileHeight }
}
export function boardHit(layout: BoardLayout, camera: BoardCamera, x: number, y: number) {
  const wx = (x - camera.x) / camera.zoom, wy = (y - camera.y) / camera.zoom
  if (wx < 0 || wy < 0) return -1
  const column = Math.floor(wx / layout.stepX), row = Math.floor(wy / layout.stepY), index = row * layout.columns + column
  return column < layout.columns && index < layout.count && wx % layout.stepX <= layout.tileWidth && wy % layout.stepY <= layout.tileHeight ? index : -1
}
/** Arithmetic culling avoids scanning the complete manifest on every pointer move. */
export function boardVisible(layout: BoardLayout, camera: BoardCamera, size: BoardSize) {
  const left = Math.max(0, Math.floor(-camera.x / camera.zoom / layout.stepX))
  const right = Math.min(layout.columns - 1, Math.floor((size.width - camera.x) / camera.zoom / layout.stepX))
  const top = Math.max(0, Math.floor(-camera.y / camera.zoom / layout.stepY))
  const bottom = Math.min(Math.ceil(layout.count / layout.columns) - 1, Math.floor((size.height - camera.y) / camera.zoom / layout.stepY))
  const indices: number[] = []
  for (let row = top; row <= bottom; row++) for (let column = left; column <= right; column++) {
    const index = row * layout.columns + column
    if (index < layout.count) indices.push(index)
  }
  return indices
}
/** Reduce resolution, never the number of accessible outputs. At most 16 MiB of requested board pixels. */
export function boardResolution(camera: BoardCamera, visibleCount: number, pixelRatio: number) {
  const desired = 256 * camera.zoom * Math.min(2, pixelRatio)
  const budgetEdge = Math.sqrt(16 * 1024 * 1024 / (4 * Math.max(1, visibleCount)))
  return 2 ** Math.max(0, Math.min(11, Math.floor(Math.log2(Math.max(1, Math.min(desired * 1.4, budgetEdge))))))
}
