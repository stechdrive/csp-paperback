/** Participating material provenance, not pixel-level occlusion by later layers. */
const approximate = new WeakSet<HTMLCanvasElement>()
const unsupported3D = new WeakSet<HTMLCanvasElement>()
export const hasVectorWarning = (canvas: HTMLCanvasElement) => approximate.has(canvas)
export const hasUnsupported3D = (canvas: HTMLCanvasElement) => unsupported3D.has(canvas)
export function markVectorWarning(canvas: HTMLCanvasElement): void { approximate.add(canvas) }
export function markUnsupported3D(canvas: HTMLCanvasElement): void { unsupported3D.add(canvas) }
export function copyRenderWarnings(target: HTMLCanvasElement, ...sources: HTMLCanvasElement[]): void {
  if (sources.some(hasVectorWarning)) approximate.add(target)
  if (sources.some(hasUnsupported3D)) unsupported3D.add(target)
}
