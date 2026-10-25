import { create } from 'zustand'
import type { OutputDestination, ExportProgressDetail } from '../types/output'

export type ExportPhase = 'idle' | 'waiting' | ExportProgressDetail['phase'] | 'saving' | 'done' | 'cancelled' | 'error'
export interface ExportJob {
  isExporting: boolean
  phase: ExportPhase
  progress: number
  done: number
  total: number
  currentFile: string
  sourceName: string
  destination: OutputDestination | 'psd'
  error: string | null
  warnings?: string[]
}
export const useExportJob = create<ExportJob>(() => ({
  isExporting: false, phase: 'idle', progress: 0, done: 0, total: 0,
  currentFile: '', sourceName: '', destination: 'zip', error: null,
}))
export const isExportInProgress = () => useExportJob.getState().isExporting
export const dismissExportStatus = () => {
  if (!isExportInProgress()) useExportJob.setState({ phase: 'idle', error: null, warnings: [] })
}
