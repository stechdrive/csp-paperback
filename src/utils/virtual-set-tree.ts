import type { CspLayer, VirtualSet } from '../types'
import type { VirtualSetDropTarget, VirtualSetNode } from '../types/marks'
import { MAX_LAYER_DEPTH } from './image-budget'
import { isMediaLayer } from './layer-display'

function indexLayers(layers: CspLayer[]): Map<string, CspLayer> {
  const result = new Map<string, CspLayer>()
  const visit = (items: CspLayer[]) => items.forEach(layer => { result.set(layer.id, layer); visit(layer.children) })
  visit(layers)
  return result
}

export function virtualNodeIds(nodes: VirtualSetNode[]): Set<string> {
  const ids = new Set<string>()
  const visit = (items: VirtualSetNode[]) => items.forEach(node => { ids.add(node.layerId); visit(node.children) })
  visit(nodes)
  return ids
}

export function findVirtualNode(nodes: VirtualSetNode[], id: string): VirtualSetNode | undefined {
  for (const node of nodes) {
    if (node.layerId === id) return node
    const found = findVirtualNode(node.children, id)
    if (found) return found
  }
}

export function renameVirtualNode(nodes: VirtualSetNode[], id: string, name: string): VirtualSetNode[] {
  return nodes.map(node => node.layerId === id ? { ...node, name }
    : { ...node, children: renameVirtualNode(node.children, id, name) })
}

/** Materialize legacy members lazily, preserving their visual order and source subtrees. */
export function virtualSetTree(vs: VirtualSet, source: CspLayer[]): VirtualSetNode[] {
  const index = indexLayers(source), seen = new Set<string>()
  if (vs.tree) {
    const filter = (nodes: VirtualSetNode[]): VirtualSetNode[] => {
      const next = nodes.filter(node => node.virtualFolder || !isMediaLayer(index.get(node.layerId))).map(node => {
        const children = filter(node.children)
        return children === node.children ? node : { ...node, children }
      })
      return next.length === nodes.length && next.every((node, i) => node === nodes[i]) ? nodes : next
    }
    return filter(vs.tree)
  }
  const convert = (layer: CspLayer): VirtualSetNode[] => {
    if (isMediaLayer(layer) || seen.has(layer.id)) return []
    seen.add(layer.id)
    return [{ layerId: layer.id, children: layer.children.flatMap(convert) }]
  }
  return vs.members.flatMap(member => {
    const layer = index.get(member.layerId)
    return layer ? convert(layer) : [{ layerId: member.layerId, children: [] }]
  })
}

/** Share source pixels/attributes, but traverse the virtual document's own hierarchy. */
export function resolveVirtualSetLayers(source: CspLayer[], vs: VirtualSet): CspLayer[] {
  const index = indexLayers(source)
  const resolve = (nodes: VirtualSetNode[], parentId: string | null, depth: number): CspLayer[] => nodes.flatMap(node => {
    const layer: CspLayer | undefined = node.virtualFolder ? {
      id: node.layerId, name: node.name ?? '新規フォルダ', originalName: node.name ?? '新規フォルダ',
      agPsdRef: {}, children: [], parentId, depth, blendMode: 'pass through', opacity: 100,
      hidden: false, clipping: false, isFolder: true, isAnimationFolder: false,
      top: 0, left: 0, width: 0, height: 0, animationFolder: null,
      singleMark: false, autoMarked: false, virtualSetMembership: [vs.id], uiHidden: false,
      expanded: false, hasAdjustmentLayer: false, display: { kind: 'folder' },
    } : index.get(node.layerId)
    if (!layer || isMediaLayer(layer)) return []
    return [{ ...layer, ...(node.name !== undefined ? { name: node.name, originalName: node.name } : {}),
      parentId, depth, children: resolve(node.children, node.layerId, depth + 1) }]
  })
  return resolve(virtualSetTree(vs, source), null, 0)
}

export function removeVirtualNodes(nodes: VirtualSetNode[], ids: Set<string>): VirtualSetNode[] {
  return nodes.filter(node => !ids.has(node.layerId)).map(node => ({ ...node, children: removeVirtualNodes(node.children, ids) }))
}

function equalTree(a: VirtualSetNode[], b: VirtualSetNode[]): boolean {
  return a.length === b.length && a.every((node, i) => node.layerId === b[i].layerId && equalTree(node.children, b[i].children))
}

function withinDepthLimit(nodes: VirtualSetNode[], depth = 1): boolean {
  return nodes.length === 0 || depth <= MAX_LAYER_DEPTH && nodes.every(node => withinDepthLimit(node.children, depth + 1))
}

function insertNodes(nodes: VirtualSetNode[], added: VirtualSetNode[], target: VirtualSetDropTarget): VirtualSetNode[] {
  if (target.layerId === null) return [...nodes, ...added]
  return nodes.flatMap(node => {
    if (node.layerId === target.layerId) {
      if (target.position === 'inside') return [{ ...node, children: [...added, ...node.children] }]
      return target.position === 'above' ? [...added, node] : [node, ...added]
    }
    return [{ ...node, children: insertNodes(node.children, added, target) }]
  })
}

export function planVirtualFolderCreation(
  vs: VirtualSet, source: CspLayer[], folderId: string, target: VirtualSetDropTarget,
): VirtualSetNode[] | null {
  const current = virtualSetTree(vs, source)
  if (target.layerId !== null) {
    const node = findVirtualNode(current, target.layerId)
    if (!node || target.position === 'inside' && !node.virtualFolder && !indexLayers(source).get(node.layerId)?.isFolder) return null
  }
  const next = insertNodes(current, [{ layerId: folderId, name: '新規フォルダ', virtualFolder: true, children: [] }], target)
  return withinDepthLimit(next) ? next : null
}

/** Pure drop plan shared by the indicator and the store commit. null = invalid or unchanged. */
export function planVirtualSetDrop(
  vs: VirtualSet, source: CspLayer[], layerIds: string[], target: VirtualSetDropTarget,
): VirtualSetNode[] | null {
  const current = virtualSetTree(vs, source), sources = indexLayers(source)
  const existing = new Map<string, VirtualSetNode>(), ordered: string[] = []
  const index = (nodes: VirtualSetNode[]) => nodes.forEach(node => {
    existing.set(node.layerId, node); ordered.push(node.layerId); index(node.children)
  })
  index(current)
  if (target.layerId !== null && (!existing.has(target.layerId) ||
    target.position === 'inside' && !existing.get(target.layerId)?.virtualFolder && !sources.get(target.layerId)?.isFolder)) return null

  // Moving a selection follows tree order, not the order in which it was clicked.
  const selected = new Set(layerIds)
  const ids = [...ordered.filter(id => selected.has(id)), ...layerIds.filter(id => !existing.has(id))]
  const build = (layer: CspLayer): VirtualSetNode => existing.get(layer.id) ?? {
    layerId: layer.id, children: layer.children.filter(child => !isMediaLayer(child)).map(build),
  }
  const candidates = ids.flatMap(id => {
    if (isMediaLayer(sources.get(id))) return []
    const node = existing.get(id)
    if (node) return [node]
    const layer = sources.get(id)
    return layer ? [build(layer)] : []
  })
  // A selected parent already carries its children. Adopt an existing child when adding its source parent.
  const descendants = new Set(candidates.flatMap(node => [...virtualNodeIds(node.children)]))
  const moved = candidates.filter(node => !descendants.has(node.layerId))
  if (!moved.length) return null
  const movingIds = virtualNodeIds(moved)
  if (target.layerId !== null && movingIds.has(target.layerId)) return null
  const remaining = removeVirtualNodes(current, movingIds)
  const next = insertNodes(remaining, moved, target)
  return !withinDepthLimit(next) || equalTree(current, next) ? null : next
}

export function withVirtualSetTree(vs: VirtualSet, tree: VirtualSetNode[]): VirtualSet {
  const members = new Map(vs.members.map(member => [member.layerId, member]))
  const layerOverrides = { ...vs.layerOverrides }
  // Keep older root-only appearance overrides when a member is moved inside a folder.
  for (const member of vs.members) layerOverrides[member.layerId] = {
    ...(member.blendMode !== null ? { blendMode: member.blendMode } : {}),
    ...(member.opacity !== null ? { opacity: member.opacity } : {}),
    ...layerOverrides[member.layerId],
  }
  return { ...vs, tree, layerOverrides, members: tree.map(node => members.get(node.layerId) ?? {
    layerId: node.layerId, blendMode: null, opacity: null,
  }) }
}
