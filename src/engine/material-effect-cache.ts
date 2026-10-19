/** Render-scoped access; owners trim only after all readers have finished compositing. */
export interface MaterialEffectCache {
  getEffect(key: string): HTMLCanvasElement | undefined
  setEffect(key: string, canvas: HTMLCanvasElement): void
}

let active: MaterialEffectCache | undefined
const sourceIds = new WeakMap<HTMLCanvasElement, number>()
let nextSourceId = 0

export function materialEffectCache(source: HTMLCanvasElement, parameters: unknown[]) {
  if (!active) return
  let id = sourceIds.get(source)
  if (id === undefined) { id = ++nextSourceId; sourceIds.set(source, id) }
  return { cache: active, key: JSON.stringify([id, source.width, source.height, ...parameters]) }
}

export function withMaterialEffectCache<T>(cache: MaterialEffectCache | undefined, render: () => T): T {
  const previous = active
  active = cache
  try { return render() } finally { active = previous }
}
