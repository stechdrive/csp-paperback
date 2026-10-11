import type { BlendMode } from 'ag-psd'

export const CLIP_BLEND_MODES: Record<number, BlendMode> = {
  0: 'normal', 1: 'darken', 2: 'multiply', 3: 'color burn', 4: 'linear burn', 5: 'subtract', 6: 'darker color',
  7: 'lighten', 8: 'screen', 9: 'color dodge', 10: 'color dodge', 11: 'linear dodge', 12: 'linear dodge', 13: 'lighter color',
  14: 'overlay', 15: 'soft light', 16: 'hard light', 17: 'vivid light', 18: 'linear light', 19: 'pin light',
  20: 'hard mix', 21: 'difference', 22: 'exclusion', 23: 'hue', 24: 'saturation', 25: 'color', 26: 'luminosity', 30: 'pass through', 36: 'divide',
}

/** A user-selected generic blend must not retain the original CSP glow semantics. */
export function nativeBlendOverride(native: number | undefined, mode: string | undefined): number | undefined {
  if (native === undefined || mode === undefined) return native
  const entry = Object.entries(CLIP_BLEND_MODES).find(([, name]) => name === mode)
  return entry ? Number(entry[0]) : undefined
}
