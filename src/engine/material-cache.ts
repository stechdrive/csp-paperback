import type { Layer, Psd } from 'ag-psd'
import type { CspLayer } from '../types'
import type { ClipDiagnostic, ClipLayer } from '../utils/clip/types'

export type MaterialState = 'unloaded' | 'loading' | 'ready' | 'evicted' | 'failed'
export interface MaterialResult {
  native?: ClipLayer
  diagnostics: ClipDiagnostic[]
}
interface Material {
  layer: Layer
  load: () => Promise<MaterialResult>
  estimate: number
  state: MaterialState
  result?: MaterialResult
  bytes: number
  used: number
  disposed: boolean
  error?: string
  diagnose?: () => ClipDiagnostic[]
}
const materials = new WeakMap<Layer, Material>()
const owners = new WeakMap<Psd, () => void>()
const resident = new Set<Material>()
const listeners = new Set<() => void>()
let revision = 0, eviction = 0, clock = 0
let serial: Promise<unknown> = Promise.resolve()
// Compressed source data remains reloadable; this is a resident-image target,
// not a limit on the sum of every layer in a document.
const CACHE_BYTES = 192 * 1024 * 1024
const WORKING_BYTES = 768 * 1024 * 1024

export class MaterialResourceError extends Error {}
const notify = () => { revision++; listeners.forEach(listener => listener()) }
export const subscribeMaterials = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const materialRevision = () => revision
export const materialEviction = () => eviction
export const materialInfo = (layer: Layer) => materials.get(layer)
export const hasDeferredMaterial = (layer: Layer) => materials.has(layer)
export function bindMaterialDiagnostics(layer: Layer, diagnose: () => ClipDiagnostic[]) {
  const material = materials.get(layer)
  if (material) material.diagnose = diagnose
}
export function materialStats() {
  return { bytes: [...resident].reduce((n, m) => n + m.bytes, 0), entries: resident.size, budget: CACHE_BYTES, eviction }
}

function release(material: Material) {
  for (const item of [material.layer, material.layer.mask, material.layer.realMask]) {
    if (item?.canvas) { item.canvas.width = 1; item.canvas.height = 1; delete item.canvas }
    if (item?.imageData) delete item.imageData
  }
  resident.delete(material)
  material.bytes = 0
  material.state = 'evicted'
  eviction++
}

export function registerMaterial(layer: Layer, estimate: number, load: Material['load']): () => void {
  const material: Material = { layer, load, estimate, state: 'unloaded', bytes: 0, used: 0, disposed: false }
  materials.set(layer, material)
  return () => { material.disposed = true; release(material); materials.delete(layer) }
}

export function ownMaterials(source: Psd, dispose: () => void) { owners.set(source, dispose) }
export function disposeMaterials(source: Psd | null) {
  if (!source) return
  owners.get(source)?.()
  owners.delete(source)
  notify()
}

function trim(pinned: Set<Material>, target = CACHE_BYTES) {
  let bytes = materialStats().bytes
  for (const material of [...resident].sort((a, b) => a.used - b.used)) {
    if (bytes <= target) break
    if (pinned.has(material)) continue
    bytes -= material.bytes
    release(material)
  }
}

/** One prepared render owns its source images until synchronous compositing ends. */
export function withPreparedMaterials<T>(layers: CspLayer[], draw: () => T, cancelled: () => boolean = () => false): Promise<T> {
  const needed = [...new Set(layers.map(layer => materials.get(layer.agPsdRef)).filter((m): m is Material => !!m))]
  const run = async () => {
    if (cancelled()) throw new Error('描画要求が変更されたため中止しました')
    const pinned = new Set(needed)
    try {
      for (const material of needed) {
        if (cancelled()) throw new Error('描画要求が変更されたため中止しました')
        if (material.disposed) throw new Error('文書が切り替わったため描画を中止しました')
        material.used = ++clock
        if (material.state === 'ready') continue
        trim(pinned, Math.max(0, CACHE_BYTES - material.estimate))
        const used = needed.reduce((n, item) => n + item.bytes, 0)
        if (used + material.estimate > WORKING_BYTES) {
          material.state = 'failed'
          material.error = 'この画像の合成に必要な素材を同時に保持できません。表示する素材を減らして再試行してください。出力は中止しました。'
          notify()
          throw new MaterialResourceError(material.error)
        }
        material.state = 'loading'
        material.error = undefined
        notify()
        try {
          const result = await material.load()
          if (material.disposed) { release(material); throw new Error('文書が切り替わったため描画を中止しました') }
          material.result = { ...result, diagnostics: [...result.diagnostics, ...(material.diagnose?.() ?? [])] }
          material.bytes = [material.layer, material.layer.mask, material.layer.realMask]
            .reduce((n, item) => n + (item?.canvas ? item.canvas.width * item.canvas.height * 4 : 0), 0)
          resident.add(material)
          if (used + material.bytes > WORKING_BYTES) {
            release(material)
            throw new MaterialResourceError('この画像に必要な素材のメモリが不足しています。出力を中止しました。')
          }
          material.state = 'ready'
        } catch (error) {
          release(material)
          material.state = 'failed'
          material.error = error instanceof Error ? error.message : '素材を読み込めませんでした'
          // Resource/worker failures are retryable. Never turn them into a
          // successful transparent layer or permanently cache the failure.
          throw error
        } finally { notify() }
      }
      if (cancelled()) throw new Error('描画要求が変更されたため中止しました')
      return draw()
    } finally { trim(new Set()) }
  }
  const result = serial.then(run, run)
  serial = result.then(() => undefined, () => undefined)
  return result
}

export function layerMaterialDiagnostics(layer: CspLayer): ClipDiagnostic[] {
  const material = materials.get(layer.agPsdRef)
  return material?.error ? [{ scope: 'raster', part: 'material', message: `${material.error}（再試行可能）` }]
    : material?.result?.diagnostics ?? []
}

/** Geometry/status belong to the source, not to cloned visibility/Undo trees. */
export function resolvedMaterialLayer(layer: CspLayer): CspLayer {
  const material = materials.get(layer.agPsdRef)
  if (!material) return layer
  if (material.state !== 'ready') throw new Error(`「${layer.originalName}」の素材を準備できていません`)
  const native = material.result?.native
  return { ...layer, left: layer.agPsdRef.left ?? 0, top: layer.agPsdRef.top ?? 0,
    width: layer.agPsdRef.canvas?.width ?? 0, height: layer.agPsdRef.canvas?.height ?? 0,
    adjustment: native?.adjustment ?? layer.adjustment,
    vectorRendering: native?.vectorRendering ?? layer.vectorRendering,
    unsupported3D: native?.unsupported3D ?? layer.unsupported3D,
    materialMissing: material.result?.diagnostics.some(d => d.outcome === 'missing-content') }
}
