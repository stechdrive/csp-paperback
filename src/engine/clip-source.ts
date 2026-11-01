import type { Layer } from 'ag-psd'
import type { ClipReader } from '../utils/clip-io'

// Source handles stay outside store and serialized projects. UI tree copies keep
// the same material identity; paired PSD materials are deliberately not bound.
const sources = new WeakMap<Layer, { layerId: string; reader: ClipReader }>()
export function bindClipSource(layer: Layer, layerId: string, reader: ClipReader): void {
  sources.set(layer, { layerId, reader })
}
export const clipSource = (layer: Layer) => sources.get(layer)

const syntheticGroups = new WeakSet<Layer>()
export function syntheticClipGroup(layer: Layer): Layer { syntheticGroups.add(layer); return layer }
export const isSyntheticClipGroup = (layer: Layer) => syntheticGroups.has(layer)
