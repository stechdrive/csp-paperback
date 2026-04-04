import { describe, it, expect } from 'vitest'
import { serializeToXmp, deserializeFromXmp, type PersistedState } from '../utils/xmp'
import { DEFAULT_PROJECT_SETTINGS } from '../types/project'

const sampleState: PersistedState = {
  singleMarkIds: ['layer-1', 'layer-2'],
  virtualSets: [
    {
      id: 'vs-1',
      name: 'テストセット',
      insertionLayerId: 'layer-3',
      memberLayerIds: ['layer-4', 'layer-5'],
      expandToAnimationCells: false,
    },
  ],
  manualAnimFolderIds: ['folder-1'],
  folderModes: { 'folder-1': 'cell-inclusive', 'folder-2': 'normal' },
  projectSettings: {
    processTable: [{ suffix: '_en', folderNames: ['EN', 'en'] }],
    sequenceDigits: 4,
    defaultMode: 'cell-inclusive',
  },
}

describe('xmp', () => {
  it('serializeToXmp が XMP XML 文字列を生成する', () => {
    const xml = serializeToXmp(sampleState)
    expect(xml).toContain('<?xpacket begin=')
    expect(xml).toContain('cspb:data=')
    expect(xml).toContain('http://ns.stechdrive.com/cspb/1.0/')
    expect(xml).toContain('<?xpacket end="w"?>')
  })

  it('serializeToXmp → deserializeFromXmp がラウンドトリップする', () => {
    const xml = serializeToXmp(sampleState)
    const restored = deserializeFromXmp(xml)
    expect(restored).not.toBeNull()
    expect(restored!.singleMarkIds).toEqual(sampleState.singleMarkIds)
    expect(restored!.virtualSets).toEqual(sampleState.virtualSets)
    expect(restored!.manualAnimFolderIds).toEqual(sampleState.manualAnimFolderIds)
    expect(restored!.folderModes).toEqual(sampleState.folderModes)
    expect(restored!.projectSettings).toEqual(sampleState.projectSettings)
  })

  it('日本語文字列を含む状態もラウンドトリップする', () => {
    const state: PersistedState = {
      ...sampleState,
      virtualSets: [
        {
          id: 'vs-jp',
          name: '日本語セット名',
          insertionLayerId: 'layer-jp',
          memberLayerIds: [],
          expandToAnimationCells: true,
        },
      ],
    }
    const xml = serializeToXmp(state)
    const restored = deserializeFromXmp(xml)
    expect(restored!.virtualSets[0].name).toBe('日本語セット名')
  })

  it('cspb:data がない XMP では null を返す', () => {
    const xml = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"></x:xmpmeta><?xpacket end="w"?>'
    expect(deserializeFromXmp(xml)).toBeNull()
  })

  it('不正な base64 では null を返す', () => {
    const xml = 'cspb:data="!!!invalid!!!"'
    expect(deserializeFromXmp(xml)).toBeNull()
  })

  it('空の状態もシリアライズできる', () => {
    const empty: PersistedState = {
      singleMarkIds: [],
      virtualSets: [],
      manualAnimFolderIds: [],
      folderModes: {},
      projectSettings: DEFAULT_PROJECT_SETTINGS,
    }
    const xml = serializeToXmp(empty)
    const restored = deserializeFromXmp(xml)
    expect(restored).not.toBeNull()
    expect(restored!.singleMarkIds).toEqual([])
    expect(restored!.virtualSets).toEqual([])
  })
})
