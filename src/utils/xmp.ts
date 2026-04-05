import type { VirtualSet, ProjectSettings } from '../types'
import { DEFAULT_PROJECT_SETTINGS } from '../types/project'

const CSPB_NS = 'http://ns.stechdrive.com/cspb/1.0/'

// ── V2 フォーマット（名前ベース。UUIDはセッションをまたいで変わるので使わない）──

export interface XmpMember {
  layerName: string
  blendMode: string | null
  opacity: number | null
}

export interface XmpVirtualSet {
  id: string                              // VS 自身の UUID（VS の同一性管理用、安定）
  name: string
  insertionLayerName: string | null       // レイヤーの originalName
  insertionPosition: 'above' | 'below'
  members: XmpMember[]
  expandToAnimationCells: boolean
  visibilityOverrides: Record<string, boolean>  // key = layerName
}

export interface PersistedState {
  version: 2
  singleMarkNames: string[]              // レイヤーの originalName
  virtualSets: XmpVirtualSet[]
  manualAnimFolderNames: string[]        // レイヤーの originalName
  projectSettings: ProjectSettings
}

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(b64: string): string {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

export function serializeToXmp(state: PersistedState): string {
  const json = JSON.stringify(state)
  const b64 = toBase64(json)
  return [
    '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    `    <rdf:Description rdf:about="" xmlns:cspb="${CSPB_NS}"`,
    `      cspb:data="${b64}"/>`,
    '  </rdf:RDF>',
    '</x:xmpmeta>',
    '<?xpacket end="w"?>',
  ].join('\n')
}

export function deserializeFromXmp(xmpXml: string): PersistedState | null {
  try {
    const match = xmpXml.match(/cspb:data="([^"]+)"/)
    if (!match) return null
    const json = fromBase64(match[1])
    const data = JSON.parse(json) as Record<string, unknown>

    // V1（version フィールドなし・singleMarkIds がある旧UUID形式）→ null を返してマーカーレイヤーにフォールバック
    if (data.version === undefined || data.version === 1) return null

    if (data.version !== 2 || !Array.isArray(data.singleMarkNames)) return null

    const rawVirtualSets: unknown[] = Array.isArray(data.virtualSets) ? data.virtualSets : []
    const virtualSets: XmpVirtualSet[] = rawVirtualSets.map(raw => {
      const r = raw as Record<string, unknown>
      const members: XmpMember[] = Array.isArray(r.members)
        ? (r.members as Record<string, unknown>[]).map((m): XmpMember => ({
            layerName: String(m.layerName ?? ''),
            blendMode: (m.blendMode as string | null) ?? null,
            opacity: typeof m.opacity === 'number' ? m.opacity : null,
          }))
        : []
      return {
        id: String(r.id ?? crypto.randomUUID()),
        name: String(r.name ?? ''),
        insertionLayerName: (r.insertionLayerName as string | null) ?? null,
        insertionPosition: (r.insertionPosition as 'above' | 'below') ?? 'above',
        members,
        expandToAnimationCells: Boolean(r.expandToAnimationCells ?? false),
        visibilityOverrides: (r.visibilityOverrides as Record<string, boolean>) ?? {},
      }
    })

    return {
      version: 2,
      singleMarkNames: (data.singleMarkNames as string[]),
      virtualSets,
      manualAnimFolderNames: Array.isArray(data.manualAnimFolderNames)
        ? (data.manualAnimFolderNames as string[])
        : [],
      projectSettings: (data.projectSettings as ProjectSettings) ?? DEFAULT_PROJECT_SETTINGS,
    }
  } catch {
    return null
  }
}

// usePersistence から VirtualSet（ID ベース）を XmpVirtualSet（名前ベース）に変換するヘルパー
export function virtualSetToXmp(
  vs: VirtualSet,
  idToName: Map<string, string>,
): XmpVirtualSet {
  return {
    id: vs.id,
    name: vs.name,
    insertionLayerName: vs.insertionLayerId ? (idToName.get(vs.insertionLayerId) ?? null) : null,
    insertionPosition: vs.insertionPosition,
    members: vs.members
      .map(m => ({
        layerName: idToName.get(m.layerId) ?? '',
        blendMode: m.blendMode,
        opacity: m.opacity,
      }))
      .filter(m => m.layerName !== ''),
    expandToAnimationCells: vs.expandToAnimationCells,
    visibilityOverrides: Object.fromEntries(
      Object.entries(vs.visibilityOverrides)
        .map(([id, v]) => [idToName.get(id) ?? '', v])
        .filter(([name]) => name !== ''),
    ),
  }
}

// XmpVirtualSet（名前ベース）を VirtualSet（ID ベース）に変換するヘルパー
export function xmpToVirtualSet(
  xvs: XmpVirtualSet,
  nameToId: Map<string, string>,
): VirtualSet {
  return {
    id: xvs.id,
    name: xvs.name,
    insertionLayerId: xvs.insertionLayerName ? (nameToId.get(xvs.insertionLayerName) ?? null) : null,
    insertionPosition: xvs.insertionPosition,
    members: xvs.members
      .map(m => ({
        layerId: nameToId.get(m.layerName) ?? '',
        blendMode: m.blendMode,
        opacity: m.opacity,
      }))
      .filter(m => m.layerId !== ''),
    expandToAnimationCells: xvs.expandToAnimationCells,
    visibilityOverrides: Object.fromEntries(
      Object.entries(xvs.visibilityOverrides)
        .map(([name, v]) => [nameToId.get(name) ?? '', v])
        .filter(([id]) => id !== ''),
    ),
  }
}
