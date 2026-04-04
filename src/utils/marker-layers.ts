import type { Layer } from 'ag-psd'
import type { CspLayer, VirtualSet } from '../types'

const SMARK_PREFIX = 'SMARK_'
const VSET_PREFIX = 'VSET_'
const INSERT_PREFIX = 'INSERT_'
const MEMBER_PREFIX = 'MEMBER_'

function make1x1Canvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas
}

function flattenCspTree(tree: CspLayer[]): CspLayer[] {
  const result: CspLayer[] = []
  const traverse = (layers: CspLayer[]) => {
    for (const layer of layers) {
      result.push(layer)
      if (layer.children.length > 0) traverse(layer.children)
    }
  }
  traverse(tree)
  return result
}

/**
 * PSD 保存前にルートレイヤー配列へ SMARK_/VSET_ マーカーレイヤーを注入する。
 * 前回保存分のマーカーは上書き除去される。
 */
export function injectMarkerLayers(
  rootChildren: Layer[],
  singleMarkIds: string[],
  virtualSets: VirtualSet[],
  layerTree: CspLayer[],
): Layer[] {
  const flat = flattenCspTree(layerTree)
  const idToName = new Map(flat.map(l => [l.id, l.originalName]))

  // 既存マーカーを除去
  const filtered = rootChildren.filter(
    l => !l.name?.startsWith(SMARK_PREFIX) && !l.name?.startsWith(VSET_PREFIX)
  )

  const markers: Layer[] = []

  // SMARK_ マーカー（手動マークのみ）
  for (const id of singleMarkIds) {
    const name = idToName.get(id)
    if (!name) continue
    markers.push({
      name: `${SMARK_PREFIX}${name}`,
      hidden: true,
      canvas: make1x1Canvas(),
    })
  }

  // VSET_ マーカー
  for (const vs of virtualSets) {
    const insertionName = vs.insertionLayerId ? idToName.get(vs.insertionLayerId) : undefined
    const memberNames = vs.memberLayerIds
      .map(id => idToName.get(id))
      .filter((n): n is string => Boolean(n))

    const children: Layer[] = [
      ...(insertionName
        ? [{ name: `${INSERT_PREFIX}${insertionName}`, hidden: true, canvas: make1x1Canvas() }]
        : []),
      ...memberNames.map(n => ({
        name: `${MEMBER_PREFIX}${n}`,
        hidden: true,
        canvas: make1x1Canvas(),
      })),
    ]

    markers.push({
      name: `${VSET_PREFIX}${vs.name}`,
      hidden: true,
      canvas: make1x1Canvas(),
      children,
    })
  }

  return [...filtered, ...markers]
}

export interface MarkerLayerState {
  markedLayerNames: string[]
  virtualSetDefs: Array<{
    name: string
    insertionLayerName: string | undefined
    memberLayerNames: string[]
  }>
}

/**
 * PSD 読み込み時のフォールバック: ルートレイヤーから SMARK_/VSET_ を読み取る。
 * XMP が存在しない古い PSD の互換性復元用。
 */
export function extractMarkerLayerState(rootChildren: Layer[]): MarkerLayerState {
  const markedLayerNames: string[] = []
  const virtualSetDefs: MarkerLayerState['virtualSetDefs'] = []

  for (const layer of rootChildren) {
    if (layer.name?.startsWith(SMARK_PREFIX)) {
      markedLayerNames.push(layer.name.slice(SMARK_PREFIX.length))
    } else if (layer.name?.startsWith(VSET_PREFIX)) {
      const setName = layer.name.slice(VSET_PREFIX.length)
      let insertionLayerName: string | undefined
      const memberLayerNames: string[] = []

      for (const child of layer.children ?? []) {
        if (child.name?.startsWith(INSERT_PREFIX)) {
          insertionLayerName = child.name.slice(INSERT_PREFIX.length)
        } else if (child.name?.startsWith(MEMBER_PREFIX)) {
          memberLayerNames.push(child.name.slice(MEMBER_PREFIX.length))
        }
      }
      virtualSetDefs.push({ name: setName, insertionLayerName, memberLayerNames })
    }
  }

  return { markedLayerNames, virtualSetDefs }
}

/**
 * markerLayerState のレイヤー名をレイヤーツリーで ID に解決して返す。
 */
export function resolveMarkerState(
  state: MarkerLayerState,
  layerTree: CspLayer[],
): {
  singleMarks: Map<string, { layerId: string; origin: 'manual' }>
  virtualSets: VirtualSet[]
} {
  const flat = flattenCspTree(layerTree)
  const nameToId = new Map(flat.map(l => [l.originalName, l.id]))

  const singleMarks = new Map<string, { layerId: string; origin: 'manual' }>()
  for (const name of state.markedLayerNames) {
    const id = nameToId.get(name)
    if (id) singleMarks.set(id, { layerId: id, origin: 'manual' })
  }

  const virtualSets: VirtualSet[] = state.virtualSetDefs.map(def => ({
    id: crypto.randomUUID(),
    name: def.name,
    insertionLayerId: (def.insertionLayerName && nameToId.get(def.insertionLayerName)) ?? '',
    memberLayerIds: def.memberLayerNames
      .map(n => nameToId.get(n))
      .filter((id): id is string => Boolean(id)),
    expandToAnimationCells: false,
  }))

  return { singleMarks, virtualSets }
}
