export const GOLDEN_CHANNEL_TOLERANCE = 1

type RgbaPixels = Uint8Array | Uint8ClampedArray

/** Compare 8-bit alpha and source-over RGB on both black and white backgrounds. */
export function compareGoldenPixels(expected: RgbaPixels, actual: RgbaPixels) {
  if (expected.length !== actual.length || expected.length % 4 !== 0) {
    throw new Error('Golden comparison requires equally sized RGBA buffers')
  }

  let overTolerancePixels = 0
  let maxAlphaDiff = 0
  let maxBlackDiff = 0
  let maxWhiteDiff = 0
  for (let i = 0; i < expected.length; i += 4) {
    const expectedAlpha = expected[i + 3], actualAlpha = actual[i + 3]
    const alphaDiff = Math.abs(expectedAlpha - actualAlpha)
    maxAlphaDiff = Math.max(maxAlphaDiff, alphaDiff)
    let overTolerance = alphaDiff > GOLDEN_CHANNEL_TOLERANCE

    for (let channel = 0; channel < 3; channel++) {
      // Straight RGB can change drastically when a nearly transparent pixel is
      // rounded. Compare its 8-bit premultiplied contribution instead. White
      // also checks the background contribution; black alone can conceal it.
      const expectedBlack = Math.round(expected[i + channel] * expectedAlpha / 255)
      const actualBlack = Math.round(actual[i + channel] * actualAlpha / 255)
      const blackDiff = Math.abs(expectedBlack - actualBlack)
      const whiteDiff = Math.abs((expectedBlack + 255 - expectedAlpha) - (actualBlack + 255 - actualAlpha))
      maxBlackDiff = Math.max(maxBlackDiff, blackDiff)
      maxWhiteDiff = Math.max(maxWhiteDiff, whiteDiff)
      if (blackDiff > GOLDEN_CHANNEL_TOLERANCE || whiteDiff > GOLDEN_CHANNEL_TOLERANCE) overTolerance = true
    }
    if (overTolerance) overTolerancePixels++
  }
  return { overTolerancePixels, maxAlphaDiff, maxBlackDiff, maxWhiteDiff }
}
