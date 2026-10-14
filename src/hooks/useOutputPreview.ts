import { useMemo } from 'react'
import { useAppStore } from '../store'
import { selectDraftOutputs, selectOutputFiles } from '../store/selectors'
import { useRenderedOutputs } from './useRenderedOutputs'
import type { RenderedOutput } from '../utils/output-render-queue'

export interface OutputPreviewEntry {
  vectorWarning?: boolean
  unsupported3D?: boolean
  canvas: HTMLCanvasElement
  flatName: string
  path: string
  outputId?: string
  sources?: RenderedOutput['sources']
}

/** Output selection is independent of source/virtual-cell editor selection. */
export function useOutputPreview(enabled = true): OutputPreviewEntry[] {
  const files = useAppStore(selectOutputFiles)
  const drafts = useAppStore(selectDraftOutputs)
  const activeId = useAppStore(s => s.activeOutputId)
  const selectedIds = useAppStore(s => s.selectedOutputIds)
  const compare = useAppStore(s => s.compareOutputs)
  const selected = useMemo(() => [...files, ...drafts].filter(file => compare ? selectedIds.has(file.outputId) : file.outputId === activeId).slice(0, 8),
    [files, drafts, activeId, selectedIds, compare])
  const images = useRenderedOutputs(selected, compare ? 'comparison' : 'full', enabled)
  return useMemo(() => images.flatMap((result, index) => result?.image ? [{
    ...result.image, flatName: selected[index].names.flatName, path: selected[index].names.path, outputId: selected[index].outputId,
  }] : []), [images, selected])
}
