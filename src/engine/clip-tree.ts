import type { Layer, Psd } from 'ag-psd'
import type { CspLayer, ProjectSettings } from '../types'
import type { ClipDocument, ClipLayer, ClipTimeline } from '../utils/clip/types'
import { buildLayerTree } from './tree-builder'
import { hasDrawableMaterialEffects } from './material-effects'

import { pixelCanvas, renderClipMaterial } from './material-image'
import { ImageBudget, imageBytes, MAX_LAYER_COUNT, MAX_LAYER_DEPTH } from '../utils/image-budget'
import { withCanvasResources } from './render-resources'
import { clipReader } from '../utils/clip-io'
import { bindMaterialDiagnostics, hasDeferredMaterial, ownMaterials, registerMaterial } from './material-cache'
import { layerRenderingDiagnostics } from '../utils/clip/rendering-status'

function checkClipCanvasBudget(clip: ClipDocument): void {
  imageBytes(clip.width, clip.height)
  const budget = new ImageBudget(), stack = clip.layers.map(layer => ({ layer, depth: 1 }))
  let count = 0, adjustment = false
  while (stack.length) {
    const { layer, depth } = stack.pop()!
    if (++count > MAX_LAYER_COUNT || depth > MAX_LAYER_DEPTH) throw new Error('CLIPのレイヤー数または階層が上限を超えました')
    if (layer.adjustment) {
      if (!adjustment) budget.reserve(clip.width, clip.height)
      adjustment = true
    } else if (layer.text?.length || layer.fragments?.length) budget.reserve(clip.width, clip.height)
    else if (layer.pixels) {
      if (layer.placement) {
        const xs = layer.placement.filter((_, i) => i % 2 === 0), ys = layer.placement.filter((_, i) => i % 2 !== 0)
        budget.reserve(Math.ceil(Math.max(...xs)) - Math.floor(Math.min(...xs)), Math.ceil(Math.max(...ys)) - Math.floor(Math.min(...ys)))
      } else budget.reserve(layer.pixels.width, layer.pixels.height)
    }
    if (layer.mask) budget.reserve(layer.mask.width, layer.mask.height)
    for (const child of layer.children) stack.push({ layer: child, depth: depth + 1 })
  }
}

/** A Layer-shaped rendering adapter, not an intermediate PSD serialization. */
export function clipRenderingSource(clip: ClipDocument): Psd {
  const reader = clipReader(clip)
  if (reader) {
    const disposers: (() => void)[] = []
    const convert = (metadata: ClipLayer): Layer => {
      const target: Layer = { name: metadata.name, hidden: metadata.hidden, opacity: metadata.opacity,
        blendMode: metadata.blendMode, clipping: metadata.clipping, top: 0, left: 0, right: 0, bottom: 0 }
      if (metadata.isFolder) {
        target.sectionDivider = { type: metadata.expanded ? 1 : 2 }
        target.children = metadata.children.slice().reverse().map(convert)
      }
      disposers.push(registerMaterial(target, clip.width * clip.height * 8, async () => {
        const { layer, diagnostics } = await reader.decode(metadata.id)
        withCanvasResources(() => {
          const rendered = renderClipMaterial(layer, clip.width, clip.height)
          if (rendered) Object.assign(target, { canvas: rendered.canvas, top: rendered.top, left: rendered.left,
            right: rendered.left + rendered.canvas.width, bottom: rendered.top + rendered.canvas.height })
          if (layer.mask) {
            const mask = layer.mask
            target.mask = { canvas: pixelCanvas(mask), top: mask.top, left: mask.left,
              bottom: mask.top + mask.height, right: mask.left + mask.width,
              defaultColor: mask.defaultColor ?? 0, disabled: mask.disabled, positionRelativeToLayer: false }
          }
        }, () => [target.canvas, target.mask?.canvas].filter((c): c is HTMLCanvasElement => !!c))
        return { native: { ...layer, pixels: undefined, fragments: undefined, mask: undefined }, diagnostics }
      }))
      return target
    }
    const source: Psd = { width: clip.width, height: clip.height, children: clip.layers.slice().reverse().map(convert) }
    ownMaterials(source, () => { reader.dispose(); disposers.forEach(dispose => dispose()) })
    return source
  }
  checkClipCanvasBudget(clip)
  // Adjustment coverage is immutable and identical across this document's adjustment layers.
  let adjustment: ReturnType<typeof renderClipMaterial>
  const retained: HTMLCanvasElement[] = []
  function convert(layer: ClipLayer): Layer {
    let rendered: ReturnType<typeof renderClipMaterial>
    try {
      rendered = layer.adjustment && adjustment ? adjustment : renderClipMaterial(layer, clip.width, clip.height)
      if (layer.adjustment) adjustment = rendered
    }
    catch (e) { clip.diagnostics.push({ scope: 'raster', layerId: layer.id, message: `「${layer.name}」: ${e instanceof Error ? e.message : String(e)}` }) }
    const result: Layer = {
      name: layer.name, hidden: layer.hidden, opacity: layer.opacity, blendMode: layer.blendMode, clipping: layer.clipping,
      top: rendered?.top ?? 0, left: rendered?.left ?? 0,
      right: rendered ? rendered.left + rendered.canvas.width : 0, bottom: rendered ? rendered.top + rendered.canvas.height : 0,
    }
    if (rendered) { result.canvas = rendered.canvas; retained.push(rendered.canvas) }
    if (layer.isFolder) {
      result.sectionDivider = { type: layer.expanded ? 1 : 2 }
      result.children = layer.children.slice().reverse().map(convert)
    }
    if (layer.mask) {
      const mask = layer.mask
      result.mask = { canvas: pixelCanvas(mask), top: mask.top, left: mask.left, bottom: mask.top + mask.height, right: mask.left + mask.width,
        defaultColor: mask.defaultColor ?? 0, disabled: mask.disabled, positionRelativeToLayer: false }
      retained.push(result.mask.canvas!)
    }
    return result
  }
  return withCanvasResources(() => ({ width: clip.width, height: clip.height, children: clip.layers.slice().reverse().map(convert) }), () => retained)
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
      r.materialMissing = clip.diagnostics.some(d => d.layerId === n.id && d.outcome === 'missing-content')
      if (paired && !n.isFolder && hasDeferredMaterial(r.agPsdRef)) {
        const ref = r.agPsdRef
        bindMaterialDiagnostics(ref, () => layerRenderingDiagnostics(n, clip.compatibility, true, !!ref.canvas))
      }
      if (!paired) { r.materialEffects = hasDrawableMaterialEffects(n.effects) ? n.effects : undefined; r.nativeBlendMode = n.nativeBlendMode; r.adjustment = n.adjustment; r.vectorRendering = n.vectorRendering; r.unsupported3D = n.unsupported3D }
      else if (!r.agPsdRef.canvas && !hasDeferredMaterial(r.agPsdRef)) {
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
