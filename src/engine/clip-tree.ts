import type { Layer, Psd } from 'ag-psd'
import type { CspLayer, ProjectSettings } from '../types'
import type { ClipDocument, ClipLayer, ClipTimeline } from '../utils/clip/types'
import { buildLayerTree } from './tree-builder'

import { pixelCanvas, renderClipMaterial } from './material-image'

/** A Layer-shaped rendering adapter, not an intermediate PSD serialization. */
export function clipRenderingSource(clip: ClipDocument): Psd {
  function convert(layer: ClipLayer): Layer {
    let rendered: ReturnType<typeof renderClipMaterial>
    try { rendered = renderClipMaterial(layer, clip.width, clip.height) }
    catch (e) { clip.diagnostics.push({ scope: 'raster', layerId: layer.id, message: `「${layer.name}」: ${e instanceof Error ? e.message : String(e)}` }) }
    const result: Layer = {
      name: layer.name, hidden: layer.hidden, opacity: layer.opacity, blendMode: layer.blendMode, clipping: layer.clipping,
      top: rendered?.top ?? 0, left: rendered?.left ?? 0,
      right: rendered ? rendered.left + rendered.canvas.width : 0, bottom: rendered ? rendered.top + rendered.canvas.height : 0,
    }
    if (rendered) result.canvas = rendered.canvas
    if (layer.isFolder) {
      result.sectionDivider = { type: layer.expanded ? 1 : 2 }
      result.children = layer.children.slice().reverse().map(convert)
    }
    if (layer.mask) {
      const mask = layer.mask
      result.mask = { canvas: pixelCanvas(mask), top: mask.top, left: mask.left, bottom: mask.top + mask.height, right: mask.left + mask.width,
        defaultColor: mask.defaultColor ?? 0, disabled: mask.disabled, positionRelativeToLayer: false }
    }
    return result
  }
  return { width: clip.width, height: clip.height, children: clip.layers.slice().reverse().map(convert) }
}

/** Validate the entire ordered hierarchy before assigning any native identities. */
export function buildClipLayerTree(clip: ClipDocument, source: Psd, timeline: ClipTimeline | undefined, settings: ProjectSettings, paired = true): CspLayer[] {
  if (source.width !== clip.width || source.height !== clip.height) throw new Error('CLIPとPSDのキャンバス寸法が一致しません。同じ保存状態からレイヤーを保持してPSDを書き出してください')
  const tree = buildLayerTree(source, undefined, settings.archivePatterns, settings.autoMarkFolderNames)
  function bind(native: ClipLayer[], rendered: CspLayer[], parentId: string | null, path: string[], parentIsAnimationFolder = false, insideCell = false) {
    const mismatch = () => new Error(`CLIPとPSDのレイヤー構造・順序が一致しません: ${path.join(' / ') || 'ルート'}。同じ保存状態からレイヤーを保持してPSDを書き出してください`)
    if (native.length !== rendered.length) throw mismatch()
    const shape = (layer: ClipLayer): unknown[] => [layer.name, layer.isFolder, layer.children.map(shape)]
    // An animation folder's direct children are cels. Descendants of those cels
    // are artwork, whose repeated layer/group names do not identify a cel track.
    // Keep their PSD stacking order; only reject ambiguity at the structural levels.
    if (paired && !insideCell && new Set(native.map(l => JSON.stringify(shape(l)))).size !== native.length) {
      throw new Error(`同じ階層に区別できない同名レイヤーがあります: ${path.join(' / ') || 'ルート'}。PSDを対応付けるには名前を区別してください`)
    }
    for (let i = 0; i < native.length; i++) {
      const n = native[i], r = rendered[i]
      if (n.name !== r.originalName || n.isFolder !== r.isFolder) throw mismatch()
      r.id = `clip:${n.id}`
      r.parentId = parentId
      if (!paired) { r.materialEffects = n.effects; r.nativeBlendMode = n.nativeBlendMode; r.adjustment = n.adjustment; r.vectorRendering = n.vectorRendering; r.unsupported3D = n.unsupported3D }
      else if (!r.agPsdRef.canvas) {
        if (n.kind === '3d') r.unsupported3D = true
        if (n.kind === 'vector') r.vectorRendering = 'unavailable'
      }
      if (n.isAnimationFolder) {
        r.isAnimationFolder = true
        r.animationFolder = { detectedBy: 'clip', trackName: n.name, trackNo: timeline?.bindings[n.id] }
      }
      bind(n.children, r.children, r.id, [...path, n.name], n.isAnimationFolder, insideCell || parentIsAnimationFolder)
    }
  }
  bind(clip.layers, tree, null, [])
  return tree
}
