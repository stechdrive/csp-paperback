import { describe, it, expect } from 'vitest'
import { serializeToXmp, deserializeFromXmp, type PersistedState } from '../utils/xmp'
import { DEFAULT_PROJECT_SETTINGS } from '../types/project'

const sampleState: PersistedState = {
  version: 2,
  singleMarkNames: ['_原図', '_背景'],
  virtualSets: [
    {
      id: 'vs-1',
      name: 'テストセット',
      insertionLayerName: 'カット01',
      insertionPosition: 'above' as const,
      members: [
        { layerName: 'レイヤーA', blendMode: null, opacity: null },
        { layerName: 'レイヤーB', blendMode: null, opacity: null },
      ],
      expandToAnimationCells: false,
      visibilityOverrides: {},
    },
  ],
  manualAnimFolderNames: ['アニメフォルダ'],
  projectSettings: {
    processTable: [{ suffix: '_en', folderNames: ['EN', 'en'] }],
    cellNamingMode: 'sequence',
    archivePatterns: ['_old', '_pool'],
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
    expect(restored!.version).toBe(2)
    expect(restored!.singleMarkNames).toEqual(sampleState.singleMarkNames)
    expect(restored!.virtualSets).toEqual(sampleState.virtualSets)
    expect(restored!.manualAnimFolderNames).toEqual(sampleState.manualAnimFolderNames)
    expect(restored!.projectSettings).toEqual(sampleState.projectSettings)
  })

  it('日本語文字列を含む状態もラウンドトリップする', () => {
    const state: PersistedState = {
      ...sampleState,
      virtualSets: [
        {
          id: 'vs-jp',
          name: '日本語セット名',
          insertionLayerName: '日本語レイヤー',
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
    expect(restored!.virtualSets[0].insertionLayerName).toBe('日本語レイヤー')
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
      version: 2,
      singleMarkNames: [],
      virtualSets: [],
      manualAnimFolderNames: [],
      projectSettings: DEFAULT_PROJECT_SETTINGS,
    }
    const xml = serializeToXmp(empty)
    const restored = deserializeFromXmp(xml)
    expect(restored).not.toBeNull()
    expect(restored!.singleMarkNames).toEqual([])
    expect(restored!.virtualSets).toEqual([])
  })

  it('V1（旧UUID形式）の XMP は null を返してマーカーレイヤーにフォールバックさせる', () => {
    // V1 形式: version フィールドなし、singleMarkIds がある
    const v1Data = {
      singleMarkIds: ['uuid-1', 'uuid-2'],
      virtualSets: [],
      manualAnimFolderIds: [],
      projectSettings: DEFAULT_PROJECT_SETTINGS,
    }
    const json = JSON.stringify(v1Data)
    const bytes = new TextEncoder().encode(json)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const b64 = btoa(binary)
    const xml = `cspb:data="${b64}"`

    // V1 は null を返す（名前ベースのマーカーレイヤーにフォールバック）
    expect(deserializeFromXmp(xml)).toBeNull()
  })

  it('blendMode 付きのメンバーもラウンドトリップする', () => {
    const state: PersistedState = {
      version: 2,
      singleMarkNames: [],
      virtualSets: [
        {
          id: 'vs-blend',
          name: 'ブレンドセット',
          insertionLayerName: null,
          insertionPosition: 'above',
          members: [
            { layerName: 'レイヤーX', blendMode: 'multiply', opacity: null },
            { layerName: 'レイヤーY', blendMode: null, opacity: null },
          ],
          expandToAnimationCells: false,
          visibilityOverrides: {},
        },
      ],
      manualAnimFolderNames: [],
      projectSettings: DEFAULT_PROJECT_SETTINGS,
    }
    const xml = serializeToXmp(state)
    const restored = deserializeFromXmp(xml)
    expect(restored!.virtualSets[0].members[0].blendMode).toBe('multiply')
    expect(restored!.virtualSets[0].members[1].blendMode).toBeNull()
  })
})
