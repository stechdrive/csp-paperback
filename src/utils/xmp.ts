import type { VirtualSet } from '../types'
import type { ProjectSettings } from '../types'
import { DEFAULT_PROJECT_SETTINGS } from '../types/project'
import type { AnimationFolderMode } from '../types'

const CSPB_NS = 'http://ns.stechdrive.com/cspb/1.0/'

export interface PersistedState {
  singleMarkIds: string[]
  virtualSets: VirtualSet[]
  manualAnimFolderIds: string[]
  folderModes: Record<string, AnimationFolderMode>
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
    const data = JSON.parse(json) as Partial<PersistedState>
    if (!Array.isArray(data.singleMarkIds)) return null
    return {
      singleMarkIds: data.singleMarkIds,
      virtualSets: data.virtualSets ?? [],
      manualAnimFolderIds: data.manualAnimFolderIds ?? [],
      folderModes: data.folderModes ?? {},
      projectSettings: data.projectSettings ?? DEFAULT_PROJECT_SETTINGS,
    }
  } catch {
    return null
  }
}
