import { useMemo } from 'react'
import { useAppStore } from '../store'
import { selectDraftOutputs, selectOutputFiles } from '../store/selectors'
import { useRenderedOutputs } from './useRenderedOutputs'
import type { RenderedOutput } from '../utils/output-render-queue'

export interface OutputPreviewEntry {
  diagnostics?: RenderedOutput['diagnostics']
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
  const selected = useMemo(() => [...files, ...drafts].filter(file => file.outputId === activeId), [files, drafts, activeId])
  const images = useRenderedOutputs(selected, 1024, enabled)
  return useMemo(() => images.flatMap((result, index) => result?.image ? [{
    ...result.image, flatName: selected[index].names.flatName, path: selected[index].names.path, outputId: selected[index].outputId,
  }] : []), [images, selected])
}
