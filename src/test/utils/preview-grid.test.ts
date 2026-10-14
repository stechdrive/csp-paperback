import { describe, expect, it } from 'vitest'
import { previewGrid } from '../../utils/preview-grid'

describe('tiled output layout', () => {
  it('fits multiple columns and reflows rather than scaling a vertical stack', () => {
    const fit = previewGrid(900, 600, 8, 16 / 9, 1)
    const small = previewGrid(900, 600, 8, 16 / 9, .5)
    const large = previewGrid(900, 600, 8, 16 / 9, 2)
    expect(fit.columns).toBeGreaterThan(1)
    expect(small.columns).toBeGreaterThan(fit.columns)
    expect(large.columns).toBeLessThan(fit.columns)
    expect(fit.tileWidth * fit.columns + fit.gap * (fit.columns - 1)).toBeLessThanOrEqual(876)
  })
  it('handles narrow panes, portrait artwork and transient hidden geometry', () => {
    for (const width of [0, 240, 390, 1280]) for (const aspect of [.5, 1, 16 / 9]) {
      const layout = previewGrid(width, 600, 8, aspect, 1)
      expect(layout.columns).toBeGreaterThanOrEqual(1)
      expect(layout.tileWidth).toBeGreaterThan(0)
      expect(Number.isFinite(layout.tileWidth)).toBe(true)
    }
  })
})
