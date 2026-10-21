import { describe, expect, it } from 'vitest'
import { boardLayout, fitBoard, zoomBoard, boardHit, boardVisible, boardRect, boardRange, boardResolution } from '../../utils/preview-grid'

describe('fixed output board', () => {
  it('rectangle selection matches image intersections in both directions across zoom, gaps and partial rows', () => {
    const layout = boardLayout({ width: 900, height: 600 }, 17, 1)
    for (let i = 0; i < 200; i++) {
      const camera = { x: -47, y: 31, zoom: .1 + i % 11 / 5 }
      const a = { x: i * 43 % 1200 - 100, y: i * 71 % 1000 - 100 }
      const b = { x: i * 61 % 1200 - 100, y: i * 29 % 1000 - 100 }
      const expected = Array.from({ length: layout.count }, (_, index) => index).filter(index => {
        const r = boardRect(layout, index), x = camera.x + r.x * camera.zoom, y = camera.y + r.y * camera.zoom
        return x <= Math.max(a.x, b.x) && x + r.width * camera.zoom >= Math.min(a.x, b.x)
          && y <= Math.max(a.y, b.y) && y + r.height * camera.zoom >= Math.min(a.y, b.y)
      })
      expect(boardRange(layout, camera, a, b)).toEqual(expected)
      expect(boardRange(layout, camera, b, a)).toEqual(expected)
    }
    expect(boardRange(layout, { x: 0, y: 0, zoom: 1 }, { x: 257, y: 5 }, { x: 274, y: 30 })).toEqual([])
  })
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
