/** Keep small overviews readable instead of rounding them to 0%. */
export function formatZoom(scale: number) {
  const percent = scale * 100
  if (percent > 0 && percent < .01) return '<0.01%'
  return `${Number(percent.toFixed(percent < 1 ? 2 : percent < 10 ? 1 : 0))}%`
}
