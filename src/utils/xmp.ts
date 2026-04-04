import type { VirtualSet, VirtualSetMember, ProjectSettings } from '../types'
import { DEFAULT_PROJECT_SETTINGS } from '../types/project'

const CSPB_NS = 'http://ns.stechdrive.com/cspb/1.0/'

export interface PersistedState {
  singleMarkIds: string[]
  virtualSets: VirtualSet[]
  manualAnimFolderIds: string[]
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

/** 旧形式（memberLayerIds: string[]）を新形式（members: VirtualSetMember[]）に変換する */
function migrateVirtualSet(raw: Record<string, unknown>): VirtualSet {
  // 新形式: members フィールドが存在する場合
  if (Array.isArray(raw.members)) {
    return {
      id: String(raw.id ?? ''),
      name: String(raw.name ?? ''),
      insertionLayerId: (raw.insertionLayerId as string | null) ?? null,
      insertionPosition: (raw.insertionPosition as 'above' | 'below') ?? 'above',
      members: (raw.members as VirtualSetMember[]).map(m => ({
        layerId: String(m.layerId ?? ''),
        blendMode: m.blendMode ?? null,
      })),
      expandToAnimationCells: Boolean(raw.expandToAnimationCells ?? false),
    }
  }
  // 旧形式: memberLayerIds: string[]
  const oldIds: string[] = Array.isArray(raw.memberLayerIds) ? raw.memberLayerIds as string[] : []
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    insertionLayerId: (raw.insertionLayerId as string | null) ?? null,
    insertionPosition: (raw.insertionPosition as 'above' | 'below') ?? 'above',
    members: oldIds.map(id => ({ layerId: id, blendMode: null })),
    expandToAnimationCells: Boolean(raw.expandToAnimationCells ?? false),
  }
}

export function deserializeFromXmp(xmpXml: string): PersistedState | null {
  try {
    const match = xmpXml.match(/cspb:data="([^"]+)"/)
    if (!match) return null
    const json = fromBase64(match[1])
    const data = JSON.parse(json) as Partial<Record<string, unknown>>
    if (!Array.isArray(data.singleMarkIds)) return null

    const rawVirtualSets: unknown[] = Array.isArray(data.virtualSets) ? data.virtualSets : []
    const virtualSets: VirtualSet[] = rawVirtualSets.map(raw =>
      migrateVirtualSet(raw as Record<string, unknown>)
    )

    return {
      singleMarkIds: data.singleMarkIds as string[],
      virtualSets,
      manualAnimFolderIds: Array.isArray(data.manualAnimFolderIds) ? data.manualAnimFolderIds as string[] : [],
      projectSettings: (data.projectSettings as ProjectSettings) ?? DEFAULT_PROJECT_SETTINGS,
    }
  } catch {
    return null
  }
}
