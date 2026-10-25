import { useCallback } from 'react'
import { useAppStore } from '../store'
import { isExportInProgress, useExportJob } from '../store/export-job'
import { outputRenderQueue } from '../utils/output-render-queue'
import { createVirtualSetPsd, virtualSetPsdName } from '../utils/virtual-set-psd'
import { savePsdFile } from '../platform/psd-save'

export function useVirtualSetPsdExport() {
  const isExporting = useExportJob(s => s.isExporting)
  const exportPsd = useCallback(async (id: string) => {
    if (isExportInProgress()) return
    const state = useAppStore.getState(), vs = state.virtualSets.find(item => item.id === id)
    if (!vs) return
    const name = virtualSetPsdName(vs.name)
    useExportJob.setState({ isExporting: true, phase: 'waiting', progress: 0, done: 0, total: 1,
      currentFile: name, sourceName: vs.name, destination: 'psd', error: null, warnings: [] })
    const resume = outputRenderQueue.pause()
    try {
      await savePsdFile(name, async () => {
        useExportJob.setState({ phase: 'rendering', progress: .1 })
        const result = await createVirtualSetPsd(state.layerTree, vs, { width: state.docWidth, height: state.docHeight,
          dpiX: state.docDpiX, dpiY: state.docDpiY, cancelled: () => useAppStore.getState().rawPsd !== state.rawPsd })
        useExportJob.setState({ phase: 'writing', progress: .9, warnings: result.warnings })
        return result.buffer
      })
      useExportJob.setState({ phase: 'done', done: 1, progress: 1 })
    } catch (error) {
      useExportJob.setState(error instanceof DOMException && error.name === 'AbortError'
        ? { phase: 'cancelled' } : { phase: 'error', error: error instanceof Error ? error.message : 'PSDを書き出せませんでした' })
    } finally { useExportJob.setState({ isExporting: false }); resume() }
  }, [])
  return { isExporting, exportPsd }
}
