import type { CompositionRenderResult, RenderComposition, RenderNode } from 'celcodec/render'
import type { CspLayer } from '../types'
import type { VirtualSet, VirtualSetLayerOverride } from '../types/marks'
import type { ClipReader } from '../utils/clip-io'
import type { PreviewRegion } from './preview-region'
import type { PlannedOutputEntry } from './cell-extractor'
import { clipSource, isSyntheticClipGroup } from './clip-source'
import { collectAnimFolderAncestorIds } from './tree-builder'
import { resolveSelectedAnimCell } from '../utils/anim-cell-selection'
import { resolveVirtualSetLayers } from '../utils/virtual-set-tree'
import { buildCompositeOverrideMap } from '../utils/virtual-set-utils'
import { nativeBlendOverride, CLIP_BLEND_MODES } from '../utils/clip/blend'
import { isMediaLayer } from '../utils/layer-display'

export interface ClipDrawing {
  width: number
  height: number
  composition: RenderComposition
  placements: ReadonlyMap<string, CspLayer>
  content: ReadonlySet<string>
  render(region: PreviewRegion): Promise<CompositionRenderResult>
}
type DrawingOptions = {
  selectedCells?: Map<string, number>
  visibility?: Record<string, boolean>
  overrides?: Record<string, VirtualSetLayerOverride>
  forceOpacity?: ReadonlySet<string>
}

function builder(tree: CspLayer[], width: number, height: number, background: 'white' | 'transparent', options: DrawingOptions = {}, readerHint?: ClipReader) {
  const sources = tree.flatMap(function flatten(layer): CspLayer[] { return [layer, ...layer.children.flatMap(flatten)] })
    .filter(layer => !isMediaLayer(layer))
  const reader: ClipReader | undefined = sources.map(layer => clipSource(layer.agPsdRef)?.reader).find(Boolean) ?? readerHint
  // PSD and paired PSD stay in the application compositor. No format fallback is
  // selected after a native render fails, and native effects are never doubled.
  if (!reader || sources.some(layer => !isSyntheticClipGroup(layer.agPsdRef) && clipSource(layer.agPsdRef)?.reader !== reader)) return undefined
  const placements = new Map<string, CspLayer>(), content = new Set<string>()
  let next = 0
  function node(layer: CspLayer, children?: RenderNode[], own = false): RenderNode {
    const source = clipSource(layer.agPsdRef), override = options.overrides?.[layer.id]
    const id = `placement:${++next}`
    placements.set(id, layer)
    if (own) content.add(layer.id)
    if (children === undefined && layer.isFolder) {
      const selectionLayer = options.visibility ? { ...layer, children: layer.children.map(child => {
        const visible = options.visibility?.[child.id]
        return visible === undefined ? child : { ...child, hidden: !visible, uiHidden: !visible }
      }) } : layer
      const cel = layer.isAnimationFolder ? resolveSelectedAnimCell(selectionLayer, options.selectedCells?.get(layer.id))?.cell : undefined
      const selected = layer.isAnimationFolder ? (cel ? [cel] : []) : layer.children
      children = selected.filter(child => !isMediaLayer(child)).map(child => node(child, undefined, own))
    }
    const blend = override?.blendMode ?? layer.blendMode
    const native = nativeBlendOverride(layer.nativeBlendMode, override?.blendMode)
      ?? Number(Object.entries(CLIP_BLEND_MODES).find(([, mode]) => mode === blend)?.[0] ?? 0)
    return { id, ...(source ? { layerId: source.layerId } : {}), ...(children === undefined ? {} : { children }),
      visible: options.visibility?.[layer.id] ?? (!layer.hidden && !layer.uiHidden),
      opacity: options.forceOpacity?.has(layer.id) ? 1 : (override?.opacity ?? layer.opacity) / 100,
      // Unknown source modes retain the parser's warning and Paperback's normal
      // fallback. The library receives this explicit application choice.
      blendMode: CLIP_BLEND_MODES[native] ? native : 0, clipping: layer.clipping }
  }
  const finish = (layers: RenderNode[]): ClipDrawing => {
    const composition: RenderComposition = { layers, ...(background === 'white' ? { background: [255, 255, 255, 255] as const } : {}) }
    return { width, height, composition, placements, content, render: region => reader.render(composition, region) }
  }
  return { node, finish, reader }
}

/** Preview cel selection is an application choice, independent of shooting time. */
export function createClipPreview(tree: CspLayer[], width: number, height: number,
  options: DrawingOptions = {}): ClipDrawing | undefined {
  const b = builder(tree, width, height, 'transparent', options)
  return b?.finish(tree.filter(l => !isMediaLayer(l)).map(l => b.node(l, undefined, true)))
}

export function virtualDrawingOptions(set: VirtualSet): DrawingOptions {
  return { visibility: set.visibilityOverrides, overrides: buildCompositeOverrideMap(set.members, set.layerOverrides ?? {}) }
}

/** Output selection belongs here. The library receives ordinary CLIP instances. */
export function createClipOutput(tree: CspLayer[], plan: PlannedOutputEntry, width: number, height: number,
  background: 'white' | 'transparent'): ClipDrawing | undefined {
  const drawing = plan.drawing
  if (!drawing) return undefined
  const forceOpacity = collectAnimFolderAncestorIds(tree)
  if (drawing.type === 'cell') {
    forceOpacity.add(drawing.folder.id); forceOpacity.add(drawing.unit.cell.id)
    drawing.unit.ignoreOpacityIds?.forEach(id => forceOpacity.add(id))
  }
  const b = builder(tree, width, height, background, { forceOpacity })
  if (!b) return undefined
  const animationAncestors = collectAnimFolderAncestorIds(tree)
  // Retain hidden/empty ordinary bases; dropping them changes clipping targets.
  function context(layer: CspLayer): RenderNode | undefined {
    if (isMediaLayer(layer) || layer.isAnimationFolder || layer.autoMarked || layer.singleMark || animationAncestors.has(layer.id)) return undefined
    return b!.node(layer, layer.isFolder ? layer.children.flatMap(l => { const n = context(l); return n ? [n] : [] }) : undefined)
  }
  let target: string, replacement: RenderNode[]
  if (drawing.type === 'cell') {
    const { folder, unit } = drawing
    const cel = unit.cell.isFolder ? b.node(unit.cell, unit.layers.map(l => b.node(l, undefined, true)), true)
      : b.node(unit.cell, undefined, true)
    target = folder.id; replacement = [b.node(folder, [cel], true)]
  } else if (drawing.type === 'layer') {
    target = drawing.layer.id; replacement = [b.node(drawing.layer, undefined, true)]
  } else {
    const set = drawing.set
    if (!set.insertionLayerId) return undefined
    target = set.insertionLayerId
    const members = resolveVirtualSetLayers(tree, set)
    const memberOptions = virtualDrawingOptions(set)
    const memberAncestors = collectAnimFolderAncestorIds(members)
    for (const id of Object.keys(memberOptions.overrides ?? {})) memberAncestors.delete(id)
    const memberBuilder = builder(members, width, height, 'transparent', { ...memberOptions, forceOpacity: memberAncestors }, b.reader)
    if (!memberBuilder) return undefined
    const memberScene = memberBuilder.finish(members.filter(l => !isMediaLayer(l)).map(l => memberBuilder.node(l, undefined, true)))
    // Prefix all instance IDs when merging two independently selected trees.
    const remap = (n: RenderNode): RenderNode => ({ ...n, id: `virtual:${n.id}`, ...(n.children ? { children: n.children.map(remap) } : {}) })
    replacement = [{ id: 'virtual:group', children: memberScene.composition.layers.map(remap), opacity: 1, blendMode: 0, clipping: false }]
    const ordinary = sourcesAt(tree, target)
    const ownContext = ordinary && context(ordinary)
    if (ownContext) replacement = set.insertionPosition === 'above' ? [...replacement, ownContext] : [ownContext, ...replacement]
    const result = b.finish(wrap(tree, target, replacement) ?? [])
    const placements = new Map(result.placements)
    memberScene.placements.forEach((layer, id) => placements.set(`virtual:${id}`, layer))
    return { ...result, placements, content: memberScene.content }
  }
  return b.finish(wrap(tree, target, replacement) ?? [])

  function wrap(layers: CspLayer[], id: string, selected: RenderNode[]): RenderNode[] | undefined {
    for (const [index, layer] of layers.entries()) {
      const children = layer.id === id ? selected : layer.isFolder ? wrap(layer.children, id, selected) : undefined
      if (children === undefined) continue
      return layers.flatMap((sibling, i) => {
        if (i === index) return layer.id === id ? children : [b!.node(layer, children)]
        const n = context(sibling); return n ? [n] : []
      })
    }
    return undefined
  }
}
function sourcesAt(layers: CspLayer[], id: string): CspLayer | undefined {
  for (const layer of layers) {
    if (layer.id === id) return layer
    const child = sourcesAt(layer.children, id)
    if (child) return child
  }
}
