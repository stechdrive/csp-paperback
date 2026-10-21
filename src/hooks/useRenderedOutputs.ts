import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useAppStore } from '../store'
import type { OutputFile } from '../utils/output-plan'
import { outputRenderQueue, renderOutputFileAsync, type RenderSize, type RenderResult } from '../utils/output-render-queue'

export function useRenderedOutputs(files: OutputFile[], size: RenderSize, enabled = true) {
  const table = useAppStore(s => s.projectSettings.processTable)
  const border = useAppStore(s => s.outputConfig.revisionBorderEnabled)
  const diagnostics = useAppStore(s => s.clipDiagnostics)
  const subscribe = useCallback((listener: () => void) => enabled
    ? outputRenderQueue.subscribe(files, size, listener) : () => {}, [files, size, enabled])
  const snapshot = useMemo(() => createSnapshot(files, size, enabled), [files, size, enabled])
  const results = useSyncExternalStore(subscribe, snapshot)
  useEffect(() => {
    if (!enabled) return
    const cancel = files.map(file => outputRenderQueue.request(file, size, (cache, cancelled, edge) => renderOutputFileAsync(file, table, border, cache, diagnostics, cancelled, edge)))
    return () => cancel.forEach(fn => fn())
  }, [files, size, table, border, enabled, diagnostics])
  return results
}

// Mutable snapshot bookkeeping belongs to the external store, outside React rendering.
function createSnapshot(files: OutputFile[], size: RenderSize, enabled: boolean) {
  let previous: (RenderResult | undefined)[] = []
  return () => {
    const next = enabled ? files.map(file => outputRenderQueue.get(file, size)) : []
    if (previous.length !== next.length || next.some((result, i) => previous[i] !== result)) previous = next
    return previous
  }
}
