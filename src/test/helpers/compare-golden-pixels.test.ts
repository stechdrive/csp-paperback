import { describe, expect, it } from 'vitest'
import { compareGoldenPixels } from './compare-golden-pixels'

const rgba = (...values: number[]) => new Uint8ClampedArray(values)

describe('golden pixel comparison', () => {
  it('accepts identical pixels at different opacities', () => {
    const pixels = rgba(12, 34, 56, 255, 128, 64, 32, 128, 255, 255, 255, 0)
    expect(compareGoldenPixels(pixels, pixels.slice())).toEqual({
      overTolerancePixels: 0, maxAlphaDiff: 0, maxBlackDiff: 0, maxWhiteDiff: 0,
    })
  })

  it('ignores RGB stored in fully transparent pixels', () => {
    expect(compareGoldenPixels(rgba(255, 10, 20, 0), rgba(0, 200, 100, 0))).toEqual({
      overTolerancePixels: 0, maxAlphaDiff: 0, maxBlackDiff: 0, maxWhiteDiff: 0,
    })
  })

  it('accepts a one-level opaque color difference', () => {
    expect(compareGoldenPixels(rgba(128, 64, 32, 255), rgba(127, 63, 31, 255))).toEqual({
      overTolerancePixels: 0, maxAlphaDiff: 0, maxBlackDiff: 1, maxWhiteDiff: 1,
    })
  })

  it('accepts near-transparent rounding despite a 255-level straight RGB difference', () => {
    expect(compareGoldenPixels(rgba(255, 255, 255, 1), rgba(0, 0, 0, 0))).toEqual({
      overTolerancePixels: 0, maxAlphaDiff: 1, maxBlackDiff: 1, maxWhiteDiff: 0,
    })
  })

  it('rejects a two-level opaque color difference', () => {
    expect(compareGoldenPixels(rgba(10, 20, 30, 255), rgba(12, 20, 30, 255))).toEqual({
      overTolerancePixels: 1, maxAlphaDiff: 0, maxBlackDiff: 2, maxWhiteDiff: 2,
    })
  })

  it('rejects an opacity difference even for black pixels', () => {
    expect(compareGoldenPixels(rgba(0, 0, 0, 4), rgba(0, 0, 0, 6))).toEqual({
      overTolerancePixels: 1, maxAlphaDiff: 2, maxBlackDiff: 0, maxWhiteDiff: 2,
    })
  })

  it('rejects a difference visible on white even when alpha and black are within one level', () => {
    expect(compareGoldenPixels(rgba(128, 0, 0, 128), rgba(125, 0, 0, 129))).toEqual({
      overTolerancePixels: 1, maxAlphaDiff: 1, maxBlackDiff: 1, maxWhiteDiff: 2,
    })
  })

  it('rejects a difference visible on black even when alpha and white are within one level', () => {
    expect(compareGoldenPixels(rgba(128, 0, 0, 128), rgba(125, 0, 0, 127))).toEqual({
      overTolerancePixels: 1, maxAlphaDiff: 1, maxBlackDiff: 2, maxWhiteDiff: 1,
    })
  })

  it('rejects a hue change in translucent artwork', () => {
    expect(compareGoldenPixels(rgba(255, 0, 0, 128), rgba(0, 255, 0, 128)).overTolerancePixels).toBe(1)
  })

  it('detects a one-pixel position shift without averaging the image', () => {
    expect(compareGoldenPixels(
      rgba(255, 0, 0, 255, 0, 0, 0, 0),
      rgba(0, 0, 0, 0, 255, 0, 0, 255),
    ).overTolerancePixels).toBe(2)
  })

  it('detects a missing pixel', () => {
    expect(compareGoldenPixels(
      rgba(255, 0, 0, 255, 0, 255, 0, 255),
      rgba(255, 0, 0, 255, 0, 0, 0, 0),
    ).overTolerancePixels).toBe(1)
  })

  it('rejects unequal or incomplete RGBA buffers', () => {
    expect(() => compareGoldenPixels(rgba(0, 0, 0, 0), rgba())).toThrow('equally sized RGBA buffers')
    expect(() => compareGoldenPixels(rgba(0, 0, 0), rgba(0, 0, 0))).toThrow('equally sized RGBA buffers')
  })
})
