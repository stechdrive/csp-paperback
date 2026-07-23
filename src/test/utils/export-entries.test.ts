import { beforeEach, describe, expect, it } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { useAppStore } from '../../store'
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT_SETTINGS } from '../../types'
import { buildOutputEntriesFromState } from '../../utils/export-entries'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

function makeAnimationTree() {
  const processFolder = makeFolder('EN', [makeLayer({ name: '修正' })])
  const cellFolder = makeFolder('1', [makeLayer({ name: '本体' }), processFolder])
  const tree = buildLayerTree(makePsd({
    children: [makeAnimationFolder('A', [cellFolder])],
  }))
  tree[0].isAnimationFolder = true
  tree[0].animationFolder = { detectedBy: 'manual', trackName: 'A' }
  return tree
}

beforeEach(resetTestStore)

describe('buildOutputEntriesFromState', () => {
  it('現在設定を抽出・工程除外・フチ適用まで一つの経路で反映する', () => {
    const tree = makeAnimationTree()
    useAppStore.setState({
      layerTree: tree,
      docWidth: 100,
      docHeight: 100,
      projectSettings: {
        ...DEFAULT_PROJECT_SETTINGS,
        processTable: [{
          suffix: '_e',
          folderNames: ['EN'],
          revisionBorderColor: '#FBECE6',
        }],
        cellNamingMode: 'sequence',
      },
    })

    const withoutBorder = buildOutputEntriesFromState(useAppStore.getState(), {
      ...DEFAULT_OUTPUT_CONFIG,
      revisionBorderEnabled: false,
    })
    expect(withoutBorder.map(entry => entry.flatName).sort()).toEqual([
      'A1.jpg',
      'A1_e.jpg',
    ])

    const excluded = buildOutputEntriesFromState(useAppStore.getState(), {
      ...DEFAULT_OUTPUT_CONFIG,
      revisionBorderEnabled: false,
      excludedProcessSuffixes: ['_e'],
    })
    expect(excluded.map(entry => entry.flatName)).toEqual(['A1.jpg'])

    const bordered = buildOutputEntriesFromState(useAppStore.getState(), {
      ...DEFAULT_OUTPUT_CONFIG,
      revisionBorderEnabled: true,
    })
    const body = bordered.find(entry => entry.flatName === 'A1.jpg')!
    const process = bordered.find(entry => entry.flatName === 'A1_e.jpg')!
    const bodyEvents = (body.canvas.getContext('2d') as unknown as {
      __getEvents: () => Array<{ type: string; props: Record<string, unknown> }>
    }).__getEvents()
    const processEvents = (process.canvas.getContext('2d') as unknown as {
      __getEvents: () => Array<{ type: string; props: Record<string, unknown> }>
    }).__getEvents()
    expect(bodyEvents.some(event =>
      event.type === 'globalCompositeOperation' && event.props.value === 'multiply'
    )).toBe(false)
    expect(processEvents.some(event =>
      event.type === 'globalCompositeOperation' && event.props.value === 'multiply'
    )).toBe(true)
  })

  it('通常抽出結果へ仮想セルを追加する', () => {
    const tree = buildLayerTree(makePsd({
      children: [makeLayer({ name: '素材' })],
    }))
    useAppStore.setState({
      layerTree: tree,
      docWidth: 100,
      docHeight: 100,
      virtualSets: [{
        id: 'virtual-1',
        name: '確認用',
        insertionLayerId: tree[0].id,
        insertionPosition: 'above',
        members: [{ layerId: tree[0].id, blendMode: null, opacity: null }],
        expandToAnimationCells: false,
        visibilityOverrides: { [tree[0].id]: true },
      }],
    })

    const entries = buildOutputEntriesFromState(useAppStore.getState(), {
      ...DEFAULT_OUTPUT_CONFIG,
      revisionBorderEnabled: false,
    })

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      path: '確認用.jpg',
      flatName: '確認用.jpg',
      sourceLayerId: 'virtual-1',
    })
  })
})
