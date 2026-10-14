/** Fit the selected sheets first, then reflow them at the user's chosen scale. */
export function previewGrid(width: number, height: number, count: number, aspect: number, zoom: number) {
  const gap = 12, caption = 26
  const availableWidth = Math.max(1, width - 24), availableHeight = Math.max(1, height - 24)
  const items = Math.max(1, count), ratio = Math.max(.01, aspect)
  let fitWidth = 1
  for (let columns = 1; columns <= items; columns++) {
    const rows = Math.ceil(items / columns)
    const candidate = Math.min((availableWidth - gap * (columns - 1)) / columns,
      ((availableHeight - gap * (rows - 1)) / rows - caption) * ratio)
    fitWidth = Math.max(fitWidth, candidate)
  }
  const tileWidth = Math.max(32, Math.floor(fitWidth * zoom))
  const columns = Math.min(items, Math.max(1, Math.floor((availableWidth + gap) / (tileWidth + gap))))
  return { tileWidth, columns, gap }
}
