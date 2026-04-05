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
      insertionPosition: 'above' as const,
      members: [
        { layerId: 'layer-4', blendMode: null },
        { layerId: 'layer-5', blendMode: null },
      ],
      expandToAnimationCells: false,
      visibilityOverrides: {},
    },
  ],
  manualAnimFolderIds: ['folder-1'],
  projectSettings: {
    processTable: [{ suffix: '_en', folderNames: ['EN', 'en'] }],
    cellNamingMode: 'sequence',
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
          insertionPosition: 'above' as const,
          members: [],
          expandToAnimationCells: true,
          visibilityOverrides: {},
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
      projectSettings: DEFAULT_PROJECT_SETTINGS,
    }
    const xml = serializeToXmp(empty)
    const restored = deserializeFromXmp(xml)
    expect(restored).not.toBeNull()
    expect(restored!.singleMarkIds).toEqual([])
    expect(restored!.virtualSets).toEqual([])
  })

  it('旧形式（memberLayerIds）を新形式（members）に自動変換する', () => {
    // 旧形式のデータを直接作成してシリアライズ
    const oldFormatData = {
      singleMarkIds: [],
      virtualSets: [
        {
          id: 'vs-old',
          name: '旧セット',
          insertionLayerId: null,
          insertionPosition: 'above',
          memberLayerIds: ['layer-a', 'layer-b'],
          expandToAnimationCells: false,
        },
      ],
      manualAnimFolderIds: [],
      projectSettings: DEFAULT_PROJECT_SETTINGS,
    }
    // JSON→base64→XMP形式に手動エンコード
    const json = JSON.stringify(oldFormatData)
    const bytes = new TextEncoder().encode(json)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const b64 = btoa(binary)
    const xml = `cspb:data="${b64}"`

    const restored = deserializeFromXmp(xml)
    expect(restored).not.toBeNull()
    expect(restored!.virtualSets[0].members).toEqual([
      { layerId: 'layer-a', blendMode: null },
      { layerId: 'layer-b', blendMode: null },
    ])
  })

  it('blendMode付きのメンバーもラウンドトリップする', () => {
    const state: PersistedState = {
      singleMarkIds: [],
      virtualSets: [
        {
          id: 'vs-blend',
          name: 'ブレンドセット',
          insertionLayerId: null,
          insertionPosition: 'above',
          members: [
            { layerId: 'layer-x', blendMode: 'multiply' },
            { layerId: 'layer-y', blendMode: null },
          ],
          expandToAnimationCells: false,
          visibilityOverrides: {},
        },
      ],
      manualAnimFolderIds: [],
      projectSettings: DEFAULT_PROJECT_SETTINGS,
    }
    const xml = serializeToXmp(state)
    const restored = deserializeFromXmp(xml)
    expect(restored!.virtualSets[0].members[0].blendMode).toBe('multiply')
    expect(restored!.virtualSets[0].members[1].blendMode).toBeNull()
  })
})
