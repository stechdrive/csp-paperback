export const MIN_MOBILE_UI_SCALE = 0.75
export const MAX_MOBILE_UI_SCALE = 2
export const DEFAULT_MOBILE_UI_SCALE = 1

export function clampMobileUiScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MOBILE_UI_SCALE
  const clamped = Math.max(MIN_MOBILE_UI_SCALE, Math.min(MAX_MOBILE_UI_SCALE, value))
  return Math.round(clamped * 100) / 100
}

export function scaleToPercent(value: number): number {
  return Math.round(clampMobileUiScale(value) * 100)
}

export function percentToScale(value: number): number {
  return clampMobileUiScale(value / 100)
}
