import type { AppStore } from '../store'
import type { CspLayer } from '../types'
import type { OutputFile } from './output-plan'
import { virtualOutputId } from './output-identity'
import { collectContextSourceLayers } from '../engine/cell-extractor'
import { flattenTree, compositeRoot } from '../engine/flatten'
import { collectMembersInTreeOrder, buildMemberFlatsWithOverride } from './virtual-set-utils'
import { recordOutputSources } from '../engine/render-sources'

/** Draft previews keep their former context and stay outside the export plan. */
export function buildDraftOutputs(tree: CspLayer[], state: Pick<AppStore, 'virtualSets' | 'docWidth' | 'docHeight' | 'outputConfig'>): OutputFile[] {
  return state.virtualSets.filter(vs => !vs.insertionLayerId).map(vs => ({
    outputId: virtualOutputId(vs.id), sourceLayerId: vs.id, flatName: vs.name, path: '',
    relativePath: vs.name, fileName: vs.name, segments: [], names: { flatName: vs.name, path: '' },
    renderCanvas: () => {
      const { docWidth: w, docHeight: h } = state
      const members = collectMembersInTreeOrder(tree, new Set(vs.members.map(m => m.layerId)))
      const flats = buildMemberFlatsWithOverride(vs.members, members, w, h, vs.visibilityOverrides, vs.layerOverrides ?? {})
      const context = flattenTree(collectContextSourceLayers(tree), w, h)
      return recordOutputSources(compositeRoot([...context, ...flats], w, h, state.outputConfig.background), flats)
    },
  }))
}
