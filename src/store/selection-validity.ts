import type { AppStore } from './index'
import { selectLayerTreeWithVisibility, selectOutputFiles } from './selectors'
import { findLayerById, findLayerPath } from '../utils/layerNavigation'

/**
 * Repair references after structural edits without moving to another output.
 * Hidden/excluded layers still exist and must remain selected, showing no image.
 */
export function normalizePreviewSelection(state: AppStore): Partial<AppStore> {
  const tree = selectLayerTreeWithVisibility(state)
  const selectedPath = state.selectedLayerId ? findLayerPath(tree, state.selectedLayerId) : []
  const selectedLayerId = selectedPath.at(-1)?.id ?? null
  const sourceMissing = !!state.selectedOutputSourceId && !findLayerById(tree, state.selectedOutputSourceId)
  const focusInvalid = !!state.focusedAnimFolderId &&
    !findLayerById(tree, state.focusedAnimFolderId)?.isAnimationFolder
  const rowMissing = selectedLayerId !== state.selectedLayerId
  if (!rowMissing && !sourceMissing && !focusInvalid) return {}
  const output = selectOutputFiles(state).find(file => file.outputId === state.activeOutputId)

  return {
    selectedLayerId,
    // Losing an editor row must not detach a still-valid output from its timeline.
    focusedAnimFolderId: output ? output.animFolderId ?? null : focusInvalid || sourceMissing || rowMissing ? null : state.focusedAnimFolderId,
    selectedOutputSourceId: output ? output.sourceLayerId : focusInvalid || sourceMissing || rowMissing ? null : state.selectedOutputSourceId,
    transientExpandedFolders: new Set(selectedPath.slice(0, -1)
      .filter(layer => layer.isFolder && !state.expandedFolders.has(layer.id))
      .map(layer => layer.id)),
  }
}
