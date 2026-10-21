import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { useAppStore } from '../../store'
import { selectOutputFiles } from '../../store/selectors'
import { showOutputView } from '../../utils/output-view'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

beforeEach(() => resetTestStore({ docWidth: 100, docHeight: 100,
  layerTree: buildLayerTree(makePsd({ children: [makeFolder('_A', [makeLayer()]), makeFolder('_B', [makeLayer()])] })) }))
afterEach(() => resetTestStore())

describe('entering single output view', () => {
  it.each(['empty', 'stale', 'cleared'] as const)('uses the first available output for a %s selection', kind => {
    const files = selectOutputFiles(useAppStore.getState())
    expect(files).toHaveLength(2)
    if (kind === 'stale') useAppStore.setState({ activeOutputId: 'removed', selectedOutputIds: new Set(['removed']) })
    if (kind === 'cleared') {
      useAppStore.getState().selectOutputFile(files[1].outputId)
      useAppStore.setState({ selectedOutputIds: new Set() })
    }
    showOutputView('single', files)
    expect(useAppStore.getState().activeOutputId).toBe(files[0].outputId)
    expect(useAppStore.getState().selectedOutputIds).toEqual(new Set([files[0].outputId]))
    expect(useAppStore.getState().outputViewMode).toBe('single')
  })
  it('keeps the active selected image, but falls back within the search results', () => {
    const files = selectOutputFiles(useAppStore.getState())
    useAppStore.getState().selectOutputFile(files[1].outputId)
    showOutputView('single', files)
    expect(useAppStore.getState().activeOutputId).toBe(files[1].outputId)
    showOutputView('single', files.slice(0, 1))
    expect(useAppStore.getState().activeOutputId).toBe(files[0].outputId)
    showOutputView('single', [])
    expect(useAppStore.getState().activeOutputId).toBeNull()
  })
})
