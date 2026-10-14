import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useAppStore } from '../store'
import type { OutputFile } from '../utils/output-plan'
import { outputRenderQueue, renderOutputFile, type RenderSize } from '../utils/output-render-queue'

export function useRenderedOutputs(files: OutputFile[], size: RenderSize, enabled = true) {
  const table = useAppStore(s => s.projectSettings.processTable)
  const border = useAppStore(s => s.outputConfig.revisionBorderEnabled)
  const version = useSyncExternalStore(outputRenderQueue.subscribe, outputRenderQueue.getVersion)
  useEffect(() => {
    if (!enabled) return
    const cancel = files.map(file => outputRenderQueue.request(file, size, () => renderOutputFile(file, table, border)))
    return () => cancel.forEach(fn => fn())
  }, [files, size, table, border, enabled])
  return useMemo(() => {
    // The queue version invalidates this snapshot after a completed render.
    void version
    return enabled ? files.map(file => outputRenderQueue.get(file, size)) : []
  }, [files, size, enabled, version])
}
