import { describe, expect, it } from 'vitest'
import { boardLayout, fitBoard, zoomBoard, boardHit, boardVisible, boardRect, boardResolution } from '../../utils/preview-grid'

describe('fixed output board', () => {
  it('fits every sheet and preserves the point under the cursor while zooming', () => {
    const size = { width: 900, height: 600 }, layout = boardLayout(size, 1500, 16 / 9), camera = fitBoard(layout, size)
    expect(boardVisible(layout, camera, size)).toHaveLength(1500)
    const next = zoomBoard(camera, 300, 240, 4, .001)
    expect((300 - next.x) / next.zoom).toBeCloseTo((300 - camera.x) / camera.zoom)
    expect((240 - next.y) / next.zoom).toBeCloseTo((240 - camera.y) / camera.zoom)
    expect(boardVisible(layout, next, size).length).toBeLessThan(1500)
    expect(boardResolution(camera, 1500, 2) ** 2 * 4 * 1500).toBeLessThanOrEqual(16 * 1024 * 1024)
  })
  it('hit testing respects gaps, edges and the last partial row', () => {
    const size = { width: 900, height: 600 }, layout = boardLayout(size, 17, 1), camera = fitBoard(layout, size)
    for (let index = 0; index < 17; index++) {
      const rect = boardRect(layout, index)
      expect(boardHit(layout, camera, camera.x + (rect.x + 10) * camera.zoom, camera.y + (rect.y + 10) * camera.zoom)).toBe(index)
    }
    expect(boardHit(layout, camera, camera.x - 1, camera.y)).toBe(-1)
    expect(boardHit(layout, camera, camera.x + (layout.tileWidth + 5) * camera.zoom, camera.y)).toBe(-1)
  })
  it('does not limit counts and bounds pixels for huge overviews', () => {
    for (const count of [1, 8, 100, 10000, 100000]) {
      const size = { width: 900, height: 600 }, layout = boardLayout(size, count, .5), camera = fitBoard(layout, size)
      expect(boardVisible(layout, camera, size)).toHaveLength(count)
      const edge = boardResolution(camera, count, 3)
      expect(edge * edge * 4 * count).toBeLessThanOrEqual(16 * 1024 * 1024)
    }
  })
})
